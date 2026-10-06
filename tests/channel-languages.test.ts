import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  seal,
  Store,
  MarketingStore,
  MarketingPublisher,
  WORKSPACE_ID,
} from '@nullge/database';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  marketing = new MarketingStore(db),
  publisher = new MarketingPublisher(db),
  actor = randomUUID();
let created = false,
  projectId = '';
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const identity = (id: string, username: string) => vi.fn(async () => json({ id, username }));

beforeAll(async () => {
  process.env.MARKETING_SECRET_KEY = 'ef'.repeat(32);
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'languages@test.invalid',
    'Language test',
  ]);
  const p = await store.project(WORKSPACE_ID, 'mellow');
  projectId = p.id;
  await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, p.revision);
}, 30000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

async function approvedPost(language: 'ko' | 'en' | 'ja') {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, {
    title: `언어 ${language}`,
    caption: `Hello in ${language}`,
    brief: '',
    channel: 'threads',
    language,
  });
  return store.transition(WORKSPACE_ID, 'mellow', post.id, actor, post.revision, 'approve');
}

it('treats an account saved before language accounts as Korean and still decrypts its token', async () => {
  // Same shape and encryption context as a row written before the migration.
  await db.query(
    `INSERT INTO channel_connections ("workspaceId","projectId",channel,revision,ciphertext,"userId",username,"verifiedAt") VALUES ($1,$2,'threads',1,$3,'111','mellow_ko',now())`,
    [WORKSPACE_ID, projectId, seal({ token: 'ko-token' }, `channel:${WORKSPACE_ID}:${projectId}:threads`)],
  );
  const threads = (await marketing.connections(WORKSPACE_ID, 'mellow')).filter(
    (c) => c.channel === 'threads',
  );
  expect(threads).toEqual([
    expect.objectContaining({ language: 'ko', username: 'mellow_ko', connected: true }),
  ]);
  expect(await marketing.connectionToken(WORKSPACE_ID, projectId, 'threads', 1)).toBe('ko-token');
});

it('connects a second account for another language on the same channel', async () => {
  vi.stubGlobal('fetch', identity('222', 'mellow_en'));
  await marketing.connect(WORKSPACE_ID, 'mellow', 'threads', actor, 0, 'en-token', 'en');
  const threads = (await marketing.connections(WORKSPACE_ID, 'mellow')).filter(
    (c) => c.channel === 'threads',
  );
  expect(threads.map((c) => [c.language, c.username])).toEqual([
    ['ko', 'mellow_ko'],
    ['en', 'mellow_en'],
  ]);
  // Every other channel still offers an empty Korean row to connect.
  const x = (await marketing.connections(WORKSPACE_ID, 'mellow')).filter((c) => c.channel === 'x');
  expect(x).toEqual([expect.objectContaining({ language: 'ko', connected: false })]);
  expect(await marketing.connectionToken(WORKSPACE_ID, projectId, 'threads', 1, 'en')).toBe('en-token');
});

it('publishes a post only through the account of its language', async () => {
  const en = await approvedPost('en');
  // The Korean account revision does not unlock the English account.
  await publisher.enqueue(WORKSPACE_ID, 'mellow', en.id, actor, en.revision, 1);
  const [job] = await db.query('SELECT snapshot FROM publication_jobs WHERE "postId"=$1', [en.id]);
  expect(job.snapshot).toMatchObject({ language: 'en', userId: '222', username: 'mellow_en' });
  // While it is queued, only the English account is locked.
  await expect(marketing.disconnect(WORKSPACE_ID, 'mellow', 'threads', actor, 1, 'en')).rejects.toMatchObject(
    { status: 409 },
  );
  const fetch = vi.fn(async (u: any) =>
    String(u).includes('/me?')
      ? json({ id: '222', username: 'mellow_en' })
      : String(u).endsWith('/threads')
        ? json({ id: '888' })
        : String(u).includes('fields=status')
          ? json({ status: 'FINISHED' })
          : String(u).endsWith('/threads_publish')
            ? json({ id: '999' })
            : json({ permalink: 'https://www.threads.net/@mellow_en/post/test' }),
  );
  vi.stubGlobal('fetch', fetch);
  await publisher.tick();
  await db.query(`UPDATE publication_jobs SET "updatedAt"=now()-interval '20 seconds'`);
  await publisher.tick();
  await publisher.tick();
  const auth = fetch.mock.calls.map(([, init]: any) => init?.headers?.Authorization).filter(Boolean);
  expect(auth.length).toBeGreaterThan(0);
  expect(new Set(auth)).toEqual(new Set(['Bearer en-token']));
  const done = (await store.dashboard(WORKSPACE_ID)).posts.find((p) => p.id === en.id)!;
  expect(done.publishStatus).toBe('published');
});

it('refuses to publish a language that has no account instead of using another one', async () => {
  const ja = await approvedPost('ja');
  await expect(publisher.enqueue(WORKSPACE_ID, 'mellow', ja.id, actor, ja.revision, 1)).rejects.toMatchObject(
    {
      status: 400,
      message: expect.stringContaining('일본어 Threads 계정을 먼저 연결해 주세요'),
    },
  );
  const [{ n }] = await db.query('SELECT count(*)::int n FROM publication_jobs WHERE "postId"=$1', [ja.id]);
  expect(n).toBe(0);
});
