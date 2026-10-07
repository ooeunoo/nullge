import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  Store,
  MarketingStore,
  MarketingPublisher,
  WORKSPACE_ID,
} from '@nullge/database';
import { isScheduled } from '@nullge/contracts';

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
  connectionRevision = 0;
const later = () => new Date(Date.now() + 3600_000).toISOString();

beforeAll(async () => {
  process.env.MARKETING_SECRET_KEY = 'aa'.repeat(32);
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'schedule@test.invalid',
    'Schedule',
  ]);
  const p = await store.project(WORKSPACE_ID, 'mellow');
  await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, p.revision);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ id: '321', username: 'mellow_kr' }))),
  );
  await marketing.connect(WORKSPACE_ID, 'mellow', 'threads', actor, 0, 'test-token');
  vi.unstubAllGlobals();
  connectionRevision = (await marketing.connections(WORKSPACE_ID, 'mellow')).find(
    (c) => c.channel === 'threads',
  )!.revision;
}, 30000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

async function approved(title: string) {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, {
    title,
    caption: `${title} 본문`,
    brief: '',
    channel: 'threads',
    language: 'ko',
  });
  return store.transition(WORKSPACE_ID, 'mellow', post.id, actor, post.revision, 'approve');
}
const jobs = async (id: string) =>
  (await db.query('SELECT count(*)::int n FROM publication_jobs WHERE "postId"=$1', [id]))[0].n as number;
const makeDue = (id: string) =>
  db.query(`UPDATE posts SET "scheduledAt"=now()-interval '1 minute' WHERE id=$1`, [id]);

it('queues a scheduled post only once it is due, with the same checks as publishing now', async () => {
  const post = await approved('예약 1');
  const s = await publisher.schedule(
    WORKSPACE_ID,
    'mellow',
    post.id,
    actor,
    post.revision,
    connectionRevision,
    later(),
  );
  expect(isScheduled(s)).toBe(true);
  await publisher.publishDue();
  expect(await jobs(post.id)).toBe(0);
  await makeDue(post.id);
  await publisher.publishDue();
  await publisher.publishDue();
  expect(await jobs(post.id)).toBe(1);
  const [row] = await db.query('SELECT "publishStatus" FROM posts WHERE id=$1', [post.id]);
  expect(row.publishStatus).toBe('queued');
});

it('drops a schedule when the post is edited or reopened afterwards', async () => {
  const post = await approved('예약 2');
  const s = await publisher.schedule(
    WORKSPACE_ID,
    'mellow',
    post.id,
    actor,
    post.revision,
    connectionRevision,
    later(),
  );
  const reopened = await store.transition(WORKSPACE_ID, 'mellow', post.id, actor, s.revision, 'reopen');
  expect(isScheduled(reopened)).toBe(false);
  await makeDue(post.id);
  await publisher.publishDue();
  expect(await jobs(post.id)).toBe(0);
});

it('records why a due schedule could not publish and does not retry it', async () => {
  const post = await approved('예약 3');
  await publisher.schedule(
    WORKSPACE_ID,
    'mellow',
    post.id,
    actor,
    post.revision,
    connectionRevision,
    later(),
  );
  // The account is reconnected after scheduling, so its revision no longer matches.
  await db.query(
    `UPDATE channel_connections SET revision=revision+1 WHERE channel='threads' AND language='ko'`,
  );
  await makeDue(post.id);
  await publisher.publishDue();
  const [row] = await db.query('SELECT "publishStatus","publishError","scheduledAt" FROM posts WHERE id=$1', [
    post.id,
  ]);
  expect(row).toMatchObject({ publishStatus: null, scheduledAt: null });
  expect(row.publishError).toContain('계정이 바뀌어');
  expect(await jobs(post.id)).toBe(0);
  await db.query(
    `UPDATE channel_connections SET revision=revision-1 WHERE channel='threads' AND language='ko'`,
  );
});

it('refuses past or far-future times and drafts, and can be cancelled', async () => {
  const post = await approved('예약 4');
  await expect(
    publisher.schedule(
      WORKSPACE_ID,
      'mellow',
      post.id,
      actor,
      post.revision,
      connectionRevision,
      new Date(Date.now() - 3600_000).toISOString(),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    publisher.schedule(
      WORKSPACE_ID,
      'mellow',
      post.id,
      actor,
      post.revision,
      connectionRevision,
      new Date(Date.now() + 90 * 86400_000).toISOString(),
    ),
  ).rejects.toMatchObject({ status: 400 });
  const draft = await store.create(WORKSPACE_ID, 'mellow', actor, {
    title: '초안',
    caption: '초안',
    brief: '',
    channel: 'threads',
    language: 'ko',
  });
  await expect(
    publisher.schedule(WORKSPACE_ID, 'mellow', draft.id, actor, draft.revision, connectionRevision, later()),
  ).rejects.toMatchObject({ status: 400 });
  const s = await publisher.schedule(
    WORKSPACE_ID,
    'mellow',
    post.id,
    actor,
    post.revision,
    connectionRevision,
    later(),
  );
  const cancelled = await publisher.unschedule(WORKSPACE_ID, 'mellow', post.id, actor, s.revision);
  expect(isScheduled(cancelled)).toBe(false);
});
