import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  database,
  MarketingPublisher,
  MarketingStore,
  seedDevelopment,
  Store,
  WORKSPACE_ID,
} from '@nullge/database';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString());
const marketing = new MarketingStore(db),
  store = new Store(db),
  publisher = new MarketingPublisher(db);
const actor = randomUUID();
let created = false;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function saveBufferKey(value = 'buffer-test-key') {
  const { configured, encryptionReady, updatedAt, ...settings } = await marketing.settings(WORKSPACE_ID);
  return marketing.saveSettings(WORKSPACE_ID, actor, {
    ...settings,
    secrets: { bufferApiKey: value },
    clear: [],
  });
}

const channel = (service = 'threads') => ({
  id: '6ab74627ea19ca0bdef00728',
  name: 'mellow.call',
  displayName: 'mellow.call',
  service,
  isDisconnected: false,
  isLocked: false,
  externalLink: `https://www.${service === 'instagram' ? 'instagram.com' : 'threads.net'}/@mellow.call`,
  organizationId: 'org-1',
});

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
    'buffer@test.invalid',
    'Buffer test',
  ]);
}, 30_000);

beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw Error('Unexpected external request');
    }),
  );
  await db.query(
    'TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts,channel_oauth,channel_connections CASCADE',
  );
  await saveBufferKey();
});

afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15_000);

describe('Buffer channel mapping and publishing', () => {
  it('sends an uploaded Instagram image through the API with a signed media URL', async () => {
    process.env.CONSOLE_ORIGIN = 'https://console.test.invalid';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: { channel: channel('instagram') } })));
    await marketing.connectBuffer(WORKSPACE_ID, 'mellow', 'instagram', actor, 0, '6ab74627ea19ca0bdef00728');
    const project = await store.project(WORKSPACE_ID, 'mellow');
    await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, project.revision);
    const draft = await store.create(WORKSPACE_ID, 'mellow', actor, {
      title: '이미지 API 테스트',
      caption: '업로드한 이미지',
      brief: '',
      channel: 'instagram',
      language: 'ko',
      image:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQYlWNgaCAAR4YCAOLoQAEz6be5AAAAAElFTkSuQmCC',
    });
    const approved = await store.transition(
      WORKSPACE_ID,
      'mellow',
      draft.id,
      actor,
      draft.revision,
      'approve',
    );
    await publisher.enqueue(WORKSPACE_ID, 'mellow', draft.id, actor, approved.revision, 1);
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ data: { createPost: { post: { id: 'image-post-1', status: 'sending' } } } }));
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    const body = JSON.parse(String(fetch.mock.calls[0]![1].body)).variables.input;
    expect(body.assets[0].image.url).toContain(
      `/api/public-assets/${draft.assetId}?workspace=${WORKSPACE_ID}`,
    );
    expect(body.metadata.instagram).toMatchObject({ type: 'post', isAiGenerated: false });
    expect(body.mode).toBe('shareNow');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the API key secret and lists usable social channels', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ data: { account: { organizations: [{ id: 'org-1', name: 'My organization' }] } } }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            channels: [channel('instagram'), { ...channel('threads'), id: 'thread-1', isLocked: true }],
          },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const settings = await marketing.settings(WORKSPACE_ID);
    expect(settings.configured.bufferApiKey).toBe(true);
    expect(JSON.stringify(settings)).not.toContain('buffer-test-key');
    expect(await marketing.bufferChannels(WORKSPACE_ID)).toEqual([
      {
        id: '6ab74627ea19ca0bdef00728',
        name: 'mellow.call',
        service: 'instagram',
        organizationName: 'My organization',
        externalLink: 'https://www.instagram.com/@mellow.call',
      },
    ]);
  });

  it('maps and verifies a Buffer channel per product without storing the shared key in the connection', async () => {
    const fetch = vi.fn().mockImplementation(async () => json({ data: { channel: channel('instagram') } }));
    vi.stubGlobal('fetch', fetch);
    await marketing.connectBuffer(WORKSPACE_ID, 'mellow', 'instagram', actor, 0, '6ab74627ea19ca0bdef00728');
    const mellow = (await marketing.connections(WORKSPACE_ID, 'mellow')).find(
      (row) => row.channel === 'instagram',
    )!;
    expect(mellow).toMatchObject({
      provider: 'buffer',
      connected: true,
      username: 'mellow.call',
      revision: 1,
    });
    expect((await marketing.connections(WORKSPACE_ID, 'clipit')).every((row) => !row.connected)).toBe(true);
    const [raw] = await db.query("SELECT ciphertext FROM channel_connections WHERE channel='instagram'");
    expect(raw.ciphertext).not.toContain('buffer-test-key');
    const { configured, encryptionReady, updatedAt, ...settings } = await marketing.settings(WORKSPACE_ID);
    await marketing.saveSettings(WORKSPACE_ID, actor, {
      ...settings,
      secrets: { instagramAppId: 'direct-meta-app-id' },
      clear: [],
    });
    expect(
      (await marketing.connections(WORKSPACE_ID, 'mellow')).find((row) => row.channel === 'instagram'),
    ).toMatchObject({ provider: 'buffer', connected: true, revision: 1 });
    await marketing.verifyConnection(WORKSPACE_ID, 'mellow', 'instagram', 1);
    expect(
      (await marketing.connections(WORKSPACE_ID, 'mellow')).find((row) => row.channel === 'instagram')
        ?.revision,
    ).toBe(2);
  });

  it('creates one approved share-now post and polls Buffer without duplicate submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: { channel: channel('threads') } })));
    await marketing.connectBuffer(WORKSPACE_ID, 'mellow', 'threads', actor, 0, '6ab74627ea19ca0bdef00728');
    const project = await store.project(WORKSPACE_ID, 'mellow');
    await store.reviewProfile(WORKSPACE_ID, 'mellow', actor, project.revision);
    const draft = await store.create(WORKSPACE_ID, 'mellow', actor, {
      title: 'Buffer 게시 테스트',
      caption: '검토된 콘텐츠입니다.',
      brief: '',
      channel: 'threads',
      language: 'ko',
    });
    const approved = await store.transition(
      WORKSPACE_ID,
      'mellow',
      draft.id,
      actor,
      draft.revision,
      'approve',
    );
    await publisher.enqueue(WORKSPACE_ID, 'mellow', draft.id, actor, approved.revision, 1);

    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          data: { createPost: { post: { id: 'buffer-post-1', status: 'sending', externalLink: null } } },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            post: {
              id: 'buffer-post-1',
              status: 'sent',
              externalLink: 'https://www.threads.net/@mellow.call/post/test',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    await publisher.tick();
    await db.query(`UPDATE publication_jobs SET "updatedAt"=now()-interval '20 seconds'`);
    await publisher.tick();
    const result = (await store.dashboard(WORKSPACE_ID)).posts.find((post) => post.id === draft.id)!;
    expect(result.publishStatus).toBe('published');
    expect(result.publishedUrl).toContain('threads.net');
    expect(fetch).toHaveBeenCalledTimes(2);
    const createBody = JSON.parse(String(fetch.mock.calls[0]![1].body));
    expect(createBody.variables.input).toMatchObject({
      channelId: '6ab74627ea19ca0bdef00728',
      mode: 'shareNow',
      schedulingType: 'automatic',
      text: '검토된 콘텐츠입니다.',
    });
  });
});
