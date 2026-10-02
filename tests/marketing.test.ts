import { randomUUID } from 'node:crypto';
import { signedAssetUrl, checkAssetSignature } from '../packages/database/src/marketing-publishing';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  Store,
  MarketingStore,
  MarketingWorker,
  MarketingPublisher,
  WORKSPACE_ID,
  seal,
  unseal,
} from '@nullge/database';
import { generationInput, integrationInput, publishConfirm } from '@nullge/contracts';
const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname))
  throw Error('Tests require local database');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  marketing = new MarketingStore(db),
  worker = new MarketingWorker(db),
  publisher = new MarketingPublisher(db),
  actor = randomUUID();
let created = false;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const plannedContent = (candidate: { title: string; caption: string; mediaPrompt: string }) =>
  JSON.stringify({
    candidates: Array.from({ length: 3 }, () => ({
      ...candidate,
      topic: candidate.title,
      angle: candidate.caption,
      keyMessage: candidate.caption,
      visualConcept: candidate.mediaPrompt ? candidate.title : '',
    })),
  });
const input = {
  prompt: '따뜻하고 차분한 느낌',
  format: 'text' as const,
  channel: 'threads' as const,
  language: 'ko' as const,
};
beforeAll(async () => {
  process.env.MARKETING_SECRET_KEY = 'ab'.repeat(32);
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'marketing@test.invalid',
    'Test',
  ]);
}, 30000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);
async function settings() {
  const current = await marketing.settings(WORKSPACE_ID);
  return marketing.saveSettings(WORKSPACE_ID, actor, {
    revision: current.revision,
    openaiModel: 'gpt-4o-mini',
    openaiInputUsd: 0.15,
    openaiOutputUsd: 0.6,
    imageUsd: 0.1,
    videoUsd: 1,
    secrets: {
      openaiKey: 'sk-TEST-NOT-REAL',
      higgsfieldKey: 'test',
      higgsfieldSecret: 'test',
      xClientId: 'test-client',
      xClientSecret: 'test-secret',
    },
    clear: [],
  });
}
describe('shared integrations and protected marketing workflow', () => {
  it('binds encrypted secrets to workspace and purpose', () => {
    const encrypted = seal({ token: 'secret' }, 'one');
    expect(encrypted).not.toContain('secret');
    expect(unseal(encrypted, 'one')).toEqual({ token: 'secret' });
    expect(() => unseal(encrypted, 'two')).toThrow();
  });
  it('never returns secrets and prevents stale settings writes', async () => {
    const saved = await settings();
    expect(saved.configured.openaiKey).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('sk-TEST');
    await expect(
      marketing.saveSettings(WORKSPACE_ID, actor, {
        ...saved,
        revision: 0,
        secrets: {},
        clear: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    const [raw] = await db.query('SELECT ciphertext FROM integrations WHERE "workspaceId"=$1', [
      WORKSPACE_ID,
    ]);
    expect(raw.ciphertext).not.toContain('sk-TEST');
  });
  it('can clear keys without exposing or restoring an environment fallback', async () => {
    const s = await marketing.settings(WORKSPACE_ID);
    const next = await marketing.saveSettings(WORKSPACE_ID, actor, {
      ...s,
      secrets: {},
      clear: ['openaiKey'],
    });
    expect(next.configured.openaiKey).toBe(false);
    await expect(marketing.quote(WORKSPACE_ID, 'mellow', actor, input)).rejects.toMatchObject({
      status: 400,
    });
    await settings();
  });
  it('validates input and disallows arbitrary actions or reference URLs', () => {
    expect(generationInput.safeParse({ ...input, autoPublish: true }).success).toBe(false);
    expect(
      publishConfirm.safeParse({
        revision: 1,
        connectionRevision: 1,
        confirmed: false,
      }).success,
    ).toBe(false);
    expect(integrationInput.safeParse({ url: 'https://evil.test' }).success).toBe(false);
  });
  it('does not call a provider on quote; requires fresh, owner-bound explicit confirmation', async () => {
    const fetch = vi.fn(() => {
      throw Error('No paid calls before confirmation');
    });
    vi.stubGlobal('fetch', fetch);
    const q = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    expect(q.totalUsd).toBeGreaterThan(0);
    await worker.tick();
    expect(fetch).not.toHaveBeenCalled();
    await expect(marketing.confirm(WORKSPACE_ID, 'clipit', actor, q.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(marketing.confirm(WORKSPACE_ID, 'mellow', randomUUID(), q.id)).rejects.toMatchObject({
      status: 404,
    });
    await db.query('UPDATE generation_jobs SET "quoteExpiresAt"=now()-interval \'1 minute\' WHERE id=$1', [
      q.id,
    ]);
    await expect(marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('rejects unsafe reference images before any external request', async () => {
    await expect(
      marketing.quote(WORKSPACE_ID, 'mellow', actor, {
        ...input,
        reference: 'https://localhost/private',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('completes one paid request into human review, not approval or publication', async () => {
    const q = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    const confirmations = await Promise.all([
      marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id),
      marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id),
    ]);
    expect(confirmations[0]).toEqual(confirmations[1]);
    const fetch = vi.fn(async () =>
      json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: plannedContent({
                title: '목소리로 시작하는 하루',
                caption: 'AI 친구와 오늘의 이야기를 나눠 보세요.',
                mediaPrompt: '',
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await worker.tick();
    await worker.tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [j] = await db.query('SELECT * FROM generation_jobs WHERE id=$1', [q.id]);
    expect(j.status).toBe('completed');
    const post = (await store.dashboard(WORKSPACE_ID)).posts.find((p) => p.id === j.postId)!;
    expect(post.status).toBe('draft');
    expect(post.approvedAt).toBeNull();
    expect(post.publishStatus).toBeNull();
    expect(post.channel).toBe('threads');
  });
  it('fails closed on a lost paid response and never auto-retries', async () => {
    const q = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    await marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id);
    const fetch = vi.fn(async () => {
      throw Error('timeout secret raw text');
    });
    vi.stubGlobal('fetch', fetch);
    await worker.tick();
    await worker.tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [j] = await db.query('SELECT status,error FROM generation_jobs WHERE id=$1', [q.id]);
    expect(j.status).toBe('uncertain');
    expect(j.error).not.toContain('secret raw text');
  });
  it('marks crashed paid submissions uncertain instead of resubmitting', async () => {
    const q = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    await marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id);
    await db.query(
      `UPDATE generation_jobs SET status='submitting',"updatedAt"=now()-interval '6 minutes' WHERE id=$1`,
      [q.id],
    );
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await worker.tick();
    expect(fetch).not.toHaveBeenCalled();
    expect((await marketing.jobs(WORKSPACE_ID, 'mellow')).find((j: any) => j.id === q.id).status).toBe(
      'uncertain',
    );
  });
  it('verifies identity and isolates tokens per product with optimistic revisions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ id: '123456', username: 'mellow_test' })),
    );
    await marketing.connect(WORKSPACE_ID, 'mellow', 'threads', actor, 0, 'test-token');
    expect((await marketing.connections(WORKSPACE_ID, 'clipit')).every((c) => !c.connected)).toBe(true);
    const rows = await marketing.connections(WORKSPACE_ID, 'mellow');
    expect(JSON.stringify(rows)).not.toContain('test-token');
    expect(rows.find((c) => c.channel === 'threads')?.username).toBe('mellow_test');
    await expect(
      marketing.connect(WORKSPACE_ID, 'mellow', 'threads', actor, 0, 'replacement'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects unapproved publication, then locks the exact reviewed content and account', async () => {
    const p = await store.project(WORKSPACE_ID, 'mellow');
    const post = await store.create(WORKSPACE_ID, 'mellow', actor, {
      title: '검토 테스트',
      caption: '오늘의 이야기를 AI 친구와 나눠 보세요.',
      brief: '',
      channel: 'threads',
      language: 'ko',
    });
    await expect(publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, 1, 1)).rejects.toMatchObject({
      status: 400,
    });
    await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, p.revision);
    const approved = await store.transition(WORKSPACE_ID, 'mellow', post.id, actor, 1, 'approve');
    await publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, approved.revision, 1);
    await expect(
      publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, approved.revision, 1),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.update(WORKSPACE_ID, 'mellow', post.id, actor, {
        ...post,
        revision: approved.revision,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(marketing.disconnect(WORKSPACE_ID, 'mellow', 'threads', actor, 1)).rejects.toMatchObject({
      status: 409,
    });
    const fetch = vi.fn(async (url: any) =>
      String(url).includes('/me?')
        ? json({ id: '123456', username: 'mellow_test' })
        : String(url).endsWith('/threads')
          ? json({ id: '888' })
          : String(url).includes('fields=status')
            ? json({ status: 'FINISHED' })
            : String(url).endsWith('/threads_publish')
              ? json({ id: '999' })
              : json({
                  permalink: 'https://www.threads.net/@mellow_test/post/test',
                }),
    );
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    await db.query(`UPDATE publication_jobs SET "updatedAt"=now()-interval '20 seconds'`);
    await publisher.tick();
    await publisher.tick();
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith('/threads_publish'))).toHaveLength(1);
    const result = (await store.dashboard(WORKSPACE_ID)).posts.find((p) => p.id === post.id)!;
    expect(result.publishStatus).toBe('published');
    expect(result.publishedUrl).toContain('threads.net');
  });
  it('blocks posts explicitly marked as test-only', async () => {
    const post = await store.create(WORKSPACE_ID, 'mellow', actor, {
      title: 'test',
      caption: '실제 게시 금지',
      brief: '',
      channel: 'threads',
      language: 'ko',
    });
    const a = await store.transition(WORKSPACE_ID, 'mellow', post.id, actor, 1, 'approve');
    await expect(
      publisher.enqueue(WORKSPACE_ID, 'mellow', post.id, actor, a.revision, 1),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires a CDN allowlist before charging for media', async () => {
    const before = process.env.HIGGSFIELD_MEDIA_HOSTS;
    delete process.env.HIGGSFIELD_MEDIA_HOSTS;
    await expect(
      marketing.quote(WORKSPACE_ID, 'mellow', actor, {
        ...input,
        format: 'image',
      }),
    ).rejects.toMatchObject({ status: 503 });
    if (before) process.env.HIGGSFIELD_MEDIA_HOSTS = before;
  });
  it('binds temporary public media URLs to asset and workspace', () => {
    process.env.CONSOLE_ORIGIN = 'https://console.nullge.com';
    const id = randomUUID(),
      u = new URL(signedAssetUrl(WORKSPACE_ID, id));
    const expires = u.searchParams.get('expires')!,
      sig = u.searchParams.get('signature')!;
    expect(() => checkAssetSignature(WORKSPACE_ID, id, expires, sig)).not.toThrow();
    expect(() => checkAssetSignature(randomUUID(), id, expires, sig)).toThrow();
    expect(() => checkAssetSignature(WORKSPACE_ID, randomUUID(), expires, sig)).toThrow();
    expect(() => checkAssetSignature(WORKSPACE_ID, id, '1000000000', sig)).toThrow();
  });
  it('submits media once and records provider failure without another paid request', async () => {
    process.env.HIGGSFIELD_MEDIA_HOSTS = 'cdn.test.invalid';
    const q = await marketing.quote(WORKSPACE_ID, 'mellow', actor, {
      ...input,
      format: 'image',
    });
    await marketing.confirm(WORKSPACE_ID, 'mellow', actor, q.id);
    const fetch = vi.fn(async (url: any, options: any) =>
      String(url).includes('openai.com')
        ? json({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: plannedContent({
                    title: '따뜻한 하루',
                    caption: 'AI 친구와 이야기해요.',
                    mediaPrompt: 'A calm editorial still life with warm ivory and lime accents.',
                  }),
                },
              },
            ],
          })
        : String(url).endsWith('/status')
          ? json({ status: 'nsfw' })
          : json({ request_id: 'mock-media-request', status: 'queued' }),
    );
    vi.stubGlobal('fetch', fetch);
    await worker.tick();
    const mediaCall = fetch.mock.calls.find(([url]) => String(url).includes('/soul/v2/standard'))!;
    expect(JSON.parse(mediaCall[1].body)).toMatchObject({
      batch_size: 1,
      resolution: '1080p',
      aspect_ratio: '3:4',
    });
    await db.query(`UPDATE generation_jobs SET "updatedAt"=now()-interval '20 seconds' WHERE id=$1`, [q.id]);
    await worker.tick();
    await worker.tick();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/soul/v2/standard'))).toHaveLength(1);
    expect((await marketing.jobs(WORKSPACE_ID, 'mellow')).find((j: any) => j.id === q.id).status).toBe(
      'failed',
    );
    delete process.env.HIGGSFIELD_MEDIA_HOSTS;
  });
  it('serializes X token rotation and preserves the confirmed account revision', async () => {
    const p = await store.project(WORKSPACE_ID, 'clipit'),
      context = `channel:${WORKSPACE_ID}:${p.id}:x`;
    await db.query(
      `INSERT INTO channel_connections ("workspaceId","projectId",channel,revision,ciphertext,"userId",username,"verifiedAt","expiresAt") VALUES ($1,$2,'x',1,$3,'12345','desk_test',now(),now()-interval '1 day')`,
      [WORKSPACE_ID, p.id, seal({ token: 'expired-token', refreshToken: 'old-refresh' }, context)],
    );
    const fetch = vi.fn(async () =>
      json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'bearer',
        expires_in: 7200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const tokens = await Promise.all([
      marketing.connectionToken(WORKSPACE_ID, p.id, 'x', 1),
      marketing.connectionToken(WORKSPACE_ID, p.id, 'x', 1),
    ]);
    expect(tokens).toEqual(['new-access', 'new-access']);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [row] = await db.query(
      'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
      [WORKSPACE_ID, p.id, 'x'],
    );
    expect(row.revision).toBe(1);
    expect(unseal(row.ciphertext, context)).toMatchObject({ refreshToken: 'new-refresh' });
  });
  it('binds OAuth states to operator and consumes them only once', async () => {
    const start = await marketing.beginX(WORKSPACE_ID, 'mellow', actor, 0, 'https://console.nullge.com');
    const u = new URL(start.url);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    await expect(
      marketing.completeX(WORKSPACE_ID, randomUUID(), u.searchParams.get('state')!, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    const [row] = await db.query('SELECT * FROM channel_oauth');
    expect(row.ciphertext).not.toContain('verifier');
    await marketing.disconnect(WORKSPACE_ID, 'mellow', 'x', actor, 0);
    await expect(
      marketing.completeX(WORKSPACE_ID, actor, u.searchParams.get('state')!, 'code'),
    ).rejects.toMatchObject({ status: 400 });
  });
});
