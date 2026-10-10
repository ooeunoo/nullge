import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  seal,
  Store,
  MarketingStore,
  MarketingPublisher,
  WORKSPACE_ID,
} from '@nullge/database';
import { isScheduled, postInput, type Channel, type Language } from '@nullge/contracts';

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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const revisionOf = async (channel: Channel, language: Language = 'ko') =>
  (
    await db.query(
      'SELECT revision FROM channel_connections WHERE "projectId"=$1 AND channel=$2 AND language=$3',
      [projectId, channel, language],
    )
  )[0].revision as number;

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
    'replies@test.invalid',
    'Replies',
  ]);
  const p = await store.project(WORKSPACE_ID, 'mellow');
  projectId = p.id;
  await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, p.revision);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ id: '321', username: 'mellow_kr' })),
  );
  await marketing.connect(WORKSPACE_ID, 'mellow', 'threads', actor, 0, 'threads-token');
  vi.unstubAllGlobals();
  // X connects through OAuth, so the test stores a valid direct connection itself.
  await db.query(
    `INSERT INTO channel_connections ("workspaceId","projectId",channel,language,revision,ciphertext,"userId",username,"verifiedAt","expiresAt")
     VALUES ($1,$2,'x','ko',1,$3,'12345','mellow_x',now(),now()+interval '1 day')`,
    [WORKSPACE_ID, p.id, seal({ token: 'x-token' }, `channel:${WORKSPACE_ID}:${p.id}:x`)],
  );
  // An English Threads account connected through Buffer.
  await db.query(
    `INSERT INTO channel_connections ("workspaceId","projectId",channel,language,provider,revision,ciphertext,"userId",username,"verifiedAt")
     VALUES ($1,$2,'threads','en','buffer',1,$3,'buf1','mellow_en',now())`,
    [WORKSPACE_ID, p.id, seal({ channelId: 'buf1' }, `channel:${WORKSPACE_ID}:${p.id}:threads:en`)],
  );
}, 30000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

async function approved(channel: Channel, replies: string[], language: Language = 'ko') {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, {
    title: `${channel} 답글`,
    caption: '첫 줄은 질문으로 시작해요.',
    brief: '',
    channel,
    language,
    replies,
  });
  expect(post.replies).toEqual(replies);
  return store.transition(WORKSPACE_ID, 'mellow', post.id, actor, post.revision, 'approve');
}
const row = async (id: string) =>
  (
    await db.query(
      'SELECT p."publishStatus",p."publishError",p."publishedUrl",j."replyIds" FROM posts p JOIN publication_jobs j ON j."postId"=p.id WHERE p.id=$1',
      [id],
    )
  )[0];

/** X API stub: tweet ids count up from 100; `failAt` makes that tweet call (1-based) fail. */
function xApi(failAt?: number) {
  let n = 0;
  const tweets: any[] = [];
  const fetch = vi.fn(async (u: any, init?: RequestInit) => {
    if (String(u).endsWith('/2/users/me')) return json({ data: { id: '12345', username: 'mellow_x' } });
    if (String(u).endsWith('/2/tweets')) {
      n++;
      if (n === failAt) return json({ error: 'forbidden' }, 403);
      tweets.push(JSON.parse(String(init!.body)));
      return json({ data: { id: String(99 + n) } });
    }
    throw Error(`unexpected ${u}`);
  });
  return { fetch, tweets };
}

describe('reply threads', () => {
  it('validates replies in the contract: at most three, each 1–500 characters', () => {
    const base = { title: 't', caption: 'c', brief: '', channel: 'x', language: 'ko' };
    expect(postInput.safeParse({ ...base, replies: ['a', 'b', 'c'] }).success).toBe(true);
    expect(postInput.safeParse({ ...base, replies: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(postInput.safeParse({ ...base, replies: ['a'.repeat(501)] }).success).toBe(false);
    expect(postInput.safeParse({ ...base, replies: ['  '] }).success).toBe(false);
    expect(postInput.safeParse(base).success).toBe(true);
  });

  it('refuses replies on Instagram and on Buffer connections, and X replies over the weighted limit', async () => {
    const insta = await store.create(WORKSPACE_ID, 'mellow', actor, {
      title: '인스타',
      caption: '본문',
      brief: '',
      channel: 'instagram',
      language: 'ko',
      replies: ['답글'],
    });
    const asset = randomUUID();
    await db.query(
      `INSERT INTO marketing_assets (id,"workspaceId","projectId",mime,content) VALUES ($1,$2,$3,'image/jpeg',$4)`,
      [asset, WORKSPACE_ID, projectId, Buffer.from('jpeg')],
    );
    await db.query(`UPDATE posts SET format='image',"assetId"=$2 WHERE id=$1`, [insta.id, asset]);
    const ok = await store.transition(WORKSPACE_ID, 'mellow', insta.id, actor, insta.revision, 'approve');
    await expect(
      publisher.enqueue(WORKSPACE_ID, 'mellow', ok.id, actor, ok.revision, 0),
    ).rejects.toMatchObject({ status: 400, message: '답글 이어 쓰기는 X·Threads만 돼요.' });

    const buffered = await approved('threads', ['답글'], 'en');
    await expect(
      publisher.enqueue(
        WORKSPACE_ID,
        'mellow',
        buffered.id,
        actor,
        buffered.revision,
        await revisionOf('threads', 'en'),
      ),
    ).rejects.toMatchObject({ status: 400, message: '답글 이어 쓰기는 직접 연결한 계정에서만 돼요.' });

    const long = await approved('x', ['짧은 답글', '가'.repeat(141)]);
    await expect(
      publisher.enqueue(WORKSPACE_ID, 'mellow', long.id, actor, long.revision, await revisionOf('x')),
    ).rejects.toMatchObject({ status: 400, message: '2번째 답글이 채널의 길이 제한을 넘어요.' });
  });

  it('posts X replies as a chain after the main post', async () => {
    const post = await approved('x', ['답 하나', '답 둘', '답 셋']);
    await publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, post.revision, await revisionOf('x'));
    const { fetch, tweets } = xApi();
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    expect(tweets).toEqual([
      { text: '첫 줄은 질문으로 시작해요.' },
      { text: '답 하나', reply: { in_reply_to_tweet_id: '100' } },
      { text: '답 둘', reply: { in_reply_to_tweet_id: '101' } },
      { text: '답 셋', reply: { in_reply_to_tweet_id: '102' } },
    ]);
    expect(await row(post.id)).toMatchObject({
      publishStatus: 'published',
      publishError: null,
      publishedUrl: 'https://x.com/i/web/status/100',
      replyIds: ['101', '102', '103'],
    });
    const listed = (await store.dashboard(WORKSPACE_ID)).posts.find((p) => p.id === post.id)!;
    expect(listed.replyIds).toEqual(['101', '102', '103']);
  });

  it('stops at the first failed reply, keeps the post published and never retries', async () => {
    const post = await approved('x', ['답 하나', '답 둘', '답 셋']);
    await publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, post.revision, await revisionOf('x'));
    const { fetch, tweets } = xApi(3);
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    expect(tweets).toHaveLength(2);
    const r = await row(post.id);
    expect(r).toMatchObject({ publishStatus: 'published', replyIds: ['101'] });
    expect(r.publishError).toMatch(/^답글 1\/3개까지 올렸어요\. 나머지는 직접 올려 주세요: /);
    await publisher.tick();
    await publisher.tick();
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith('/2/tweets'))).toHaveLength(3);
    expect((await row(post.id)).replyIds).toEqual(['101']);
  });

  it('posts Threads replies as container + publish pairs chained by reply_to_id', async () => {
    const post = await approved('threads', ['이어서 하나', '이어서 둘']);
    await publisher.enqueue(
      WORKSPACE_ID,
      'mellow',
      post.id,
      actor,
      post.revision,
      await revisionOf('threads'),
    );
    let container = 500,
      published = 900;
    const containers: Record<string, string>[] = [],
      publishes: string[] = [];
    const fetch = vi.fn(async (u: any, init?: RequestInit) => {
      const s = String(u);
      if (s.includes('/me?')) return json({ id: '321', username: 'mellow_kr' });
      if (s.endsWith('/321/threads')) {
        containers.push(Object.fromEntries(new URLSearchParams(String(init!.body))));
        return json({ id: String(++container) });
      }
      if (s.includes('fields=status')) return json({ status: 'FINISHED' });
      if (s.endsWith('/321/threads_publish')) {
        publishes.push(new URLSearchParams(String(init!.body)).get('creation_id')!);
        return json({ id: String(++published) });
      }
      if (s.includes('fields=permalink'))
        return json({ permalink: 'https://www.threads.net/@mellow_kr/post/abc' });
      throw Error(`unexpected ${s}`);
    });
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    await db.query(`UPDATE publication_jobs SET "updatedAt"=now()-interval '20 seconds' WHERE "postId"=$1`, [
      post.id,
    ]);
    await publisher.tick();
    expect(containers).toEqual([
      { media_type: 'TEXT', text: '첫 줄은 질문으로 시작해요.', auto_publish_text: 'false' },
      { media_type: 'TEXT', text: '이어서 하나', reply_to_id: '901' },
      { media_type: 'TEXT', text: '이어서 둘', reply_to_id: '902' },
    ]);
    expect(publishes).toEqual(['501', '502', '503']);
    expect(await row(post.id)).toMatchObject({
      publishStatus: 'published',
      publishError: null,
      publishedUrl: 'https://www.threads.net/@mellow_kr/post/abc',
      replyIds: ['902', '903'],
    });
    await publisher.tick();
    expect(publishes).toHaveLength(3);
  });

  it('treats a replies edit as a content change: approval and schedule are reset', async () => {
    const post = await approved('threads', ['처음 답글']);
    const s = await publisher.schedule(
      WORKSPACE_ID,
      'mellow',
      post.id,
      actor,
      post.revision,
      await revisionOf('threads'),
      new Date(Date.now() + 3600_000).toISOString(),
    );
    expect(isScheduled(s)).toBe(true);
    const edited = await store.update(WORKSPACE_ID, 'mellow', post.id, actor, {
      title: s.title,
      caption: s.caption,
      brief: s.brief,
      channel: s.channel,
      language: s.language,
      replies: ['고친 답글'],
      revision: s.revision,
    });
    expect(edited).toMatchObject({ status: 'draft', approvedAt: null, replies: ['고친 답글'] });
    expect(edited.revision).toBe(s.revision + 1);
    expect(isScheduled(edited)).toBe(false);
    // A client that leaves replies out keeps the saved ones.
    const kept = await store.update(WORKSPACE_ID, 'mellow', post.id, actor, {
      title: '제목만 바꿈',
      caption: s.caption,
      brief: s.brief,
      channel: s.channel,
      language: s.language,
      revision: edited.revision,
    });
    expect(kept.replies).toEqual(['고친 답글']);
  });
});
