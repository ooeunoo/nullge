import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  database,
  MarketingStore,
  Store,
  WORKSPACE_ID,
  seedDevelopment,
  seal,
  unseal,
} from '@nullge/database';
import { integrationInput, type Channel, type IntegrationInput } from '@nullge/contracts';
import { metaScopes, oauthHash } from '../packages/database/src/marketing-oauth';
import { X_SCOPES } from '../packages/database/src/marketing-providers';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString());
const marketing = new MarketingStore(db),
  store = new Store(db),
  actor = randomUUID();
const origin = 'https://console.nullge.com';
let created = false;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const secrets = {
  xClientId: 'test-x-id',
  xClientSecret: 'test-x-secret',
  instagramClientId: 'test-ig-id',
  instagramClientSecret: 'test-ig-secret',
  threadsClientId: 'test-th-id',
  threadsClientSecret: 'test-th-secret',
};
async function saveSecrets(values: IntegrationInput['secrets'], clear: IntegrationInput['clear'] = []) {
  const { configured, encryptionReady, updatedAt, ...current } = await marketing.settings(WORKSPACE_ID);
  return marketing.saveSettings(WORKSPACE_ID, actor, { ...current, secrets: values, clear });
}
async function row(channel: Channel, slug = 'mellow') {
  return (await marketing.connections(WORKSPACE_ID, slug)).find((r: any) => r.channel === channel)!;
}
async function start(channel: Channel = 'instagram', slug = 'mellow') {
  const connection = await row(channel, slug);
  const { url } = await marketing.beginOAuth(WORKSPACE_ID, slug, channel, actor, connection.revision, origin);
  return new URL(url);
}
function mockMeta(channel: 'instagram' | 'threads', wrapper = false) {
  const short = { access_token: 'short-test-token', user_id: '12345678901234567' };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(wrapper ? { data: [short] } : short))
    .mockResolvedValueOnce(json({ access_token: 'long-test-token', expires_in: 5184000 }))
    .mockResolvedValueOnce(
      json(
        channel === 'instagram'
          ? { user_id: '12345678901234567', username: 'mellow_test' }
          : { id: '12345678901234567', username: 'mellow_test' },
      ),
    );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
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
    'oauth@test.invalid',
    'OAuth test',
  ]);
}, 30000);
beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw Error('Unexpected external request');
    }),
  );
  await db.query('DELETE FROM channel_oauth');
  await db.query('DELETE FROM channel_connections');
  await saveSecrets(secrets);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

describe('product OAuth without generation or publication', () => {
  it.each(['instagram', 'threads'] as const)(
    'connects %s with long-lived encrypted tokens and exact callback',
    async (channel) => {
      const url = await start(channel),
        state = url.searchParams.get('state')!;
      expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/api/channels/${channel}/callback`);
      expect(url.searchParams.get('scope')?.split(',')).toEqual(metaScopes[channel]);
      expect(url.searchParams.has('client_secret')).toBe(false);
      const [pending] = await db.query('SELECT * FROM channel_oauth');
      expect(pending.hash).not.toBe(state);
      expect(pending.ciphertext).not.toContain('redirectUri');
      const fetch = mockMeta(channel, channel === 'instagram');
      expect(await marketing.completeOAuth(WORKSPACE_ID, actor, channel, state, 'test-code')).toEqual({
        slug: 'mellow',
        connected: true,
      });
      const connected = await row(channel);
      expect(connected).toMatchObject({
        connected: true,
        userId: '12345678901234567',
        username: 'mellow_test',
        revision: 1,
      });
      expect(new Date(connected.expiresAt).getTime()).toBeGreaterThan(Date.now() + 59 * 86400000);
      const [raw] = await db.query('SELECT * FROM channel_connections WHERE channel=$1', [channel]);
      expect(raw.ciphertext).not.toContain('long-test-token');
      expect(unseal(raw.ciphertext, `channel:${WORKSPACE_ID}:${raw.projectId}:${channel}`)).toMatchObject({
        token: 'long-test-token',
        longLived: true,
      });
      expect(JSON.stringify(await marketing.connections(WORKSPACE_ID, 'mellow'))).not.toContain('test-token');
      expect((await row(channel, 'clipit')).connected).toBe(false);
      const body = new URLSearchParams(fetch.mock.calls[0]![1].body);
      expect(body.get('redirect_uri')).toBe(url.searchParams.get('redirect_uri'));
      expect(body.get('code')).toBe('test-code');
      expect(new URL(fetch.mock.calls[1]![0]).searchParams.get('grant_type')).toBe(
        channel === 'instagram' ? 'ig_exchange_token' : 'th_exchange_token',
      );
      expect(fetch).toHaveBeenCalledTimes(3);
      await expect(
        marketing.completeOAuth(WORKSPACE_ID, actor, channel, state, 'test-code'),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetch).toHaveBeenCalledTimes(3);
      const [counts] = await db.query(
        'SELECT (SELECT count(*) FROM posts)::int posts,(SELECT count(*) FROM generation_jobs)::int generations,(SELECT count(*) FROM publication_jobs)::int publications',
      );
      expect(counts).toEqual({ posts: 0, generations: 0, publications: 0 });
    },
  );
  it('rejects cross-provider, actor, and workspace callbacks without consuming the right attempt', async () => {
    const state = (await start()).searchParams.get('state')!;
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'threads', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, randomUUID(), 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      marketing.completeOAuth(randomUUID(), actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    mockMeta('instagram');
    expect((await marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code')).connected).toBe(
      true,
    );
  });
  it('consumes cancellation once and preserves an existing connection', async () => {
    mockMeta('threads');
    let state = (await start('threads')).searchParams.get('state')!;
    await marketing.completeOAuth(WORKSPACE_ID, actor, 'threads', state, 'code');
    const before = await row('threads');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    state = (await start('threads')).searchParams.get('state')!;
    expect(await marketing.completeOAuth(WORKSPACE_ID, actor, 'threads', state, '', true)).toEqual({
      slug: 'mellow',
      connected: false,
    });
    expect(await row('threads')).toEqual(before);
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'threads', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects expired states, settings changes, stale connections and disconnected attempts before exchange', async () => {
    let state = (await start()).searchParams.get('state')!;
    await db.query(`UPDATE channel_oauth SET "expiresAt"=now()-interval '1 second'`);
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    state = (await start()).searchParams.get('state')!;
    await saveSecrets({});
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 409 });
    state = (await start()).searchParams.get('state')!;
    await db.query("UPDATE channel_connections SET revision=revision+1 WHERE channel='instagram'");
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 409 });
    state = (await start()).searchParams.get('state')!;
    await marketing.disconnect(WORKSPACE_ID, 'mellow', 'instagram', actor, (await row('instagram')).revision);
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 400 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('exchanges concurrent callbacks only once', async () => {
    const state = (await start()).searchParams.get('state')!,
      fetch = mockMeta('instagram');
    const results = await Promise.allSettled(
      [1, 2].map(() => marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('does not overwrite a connection changed during exchange', async () => {
    const state = (await start()).searchParams.get('state')!;
    const fetch = mockMeta('instagram');
    fetch
      .mockReset()
      .mockImplementationOnce(async () => {
        await db.query("UPDATE channel_connections SET revision=revision+1 WHERE channel='instagram'");
        return json({ access_token: 'short-token' });
      })
      .mockResolvedValueOnce(json({ access_token: 'long-token', expires_in: 5184000 }))
      .mockResolvedValueOnce(json({ user_id: '12345678901234567', username: 'mellow_test' }));
    await expect(
      marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
    ).rejects.toMatchObject({ status: 409 });
    expect((await row('instagram')).connected).toBe(false);
  });
  it.each(['exchange', 'lifetime', 'identity'])(
    'preserves old credentials on %s failure without retry',
    async (stage) => {
      let state = (await start()).searchParams.get('state')!;
      mockMeta('instagram');
      await marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code');
      const before = await row('instagram');
      state = (await start()).searchParams.get('state')!;
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      if (stage === 'exchange') fetch.mockResolvedValueOnce(json({ error: 'token-secret-do-not-log' }, 500));
      else {
        fetch.mockResolvedValueOnce(json({ access_token: 'short' }));
        fetch.mockResolvedValueOnce(
          json({ access_token: 'long', expires_in: stage === 'lifetime' ? -1 : 5184000 }),
        );
        if (stage === 'identity')
          fetch.mockResolvedValueOnce(json({ user_id: 12345678901234567, username: 'bad' }));
      }
      await expect(
        marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
      ).rejects.toThrow();
      expect(await row('instagram')).toEqual(before);
      const count = fetch.mock.calls.length;
      await expect(
        marketing.completeOAuth(WORKSPACE_ID, actor, 'instagram', state, 'code'),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetch).toHaveBeenCalledTimes(count);
    },
  );
  it('keeps other services and unchanged app keys connected when settings are saved', async () => {
    const p = await store.project(WORKSPACE_ID, 'mellow');
    for (const channel of ['x', 'instagram', 'threads'] as const)
      await db.query(
        'INSERT INTO channel_connections ("workspaceId","projectId",channel,ciphertext,revision) VALUES ($1,$2,$3,$4,1)',
        [WORKSPACE_ID, p.id, channel, seal({ token: 'saved' }, `channel:${WORKSPACE_ID}:${p.id}:${channel}`)],
      );
    await saveSecrets(secrets);
    expect(
      (await marketing.connections(WORKSPACE_ID, 'mellow')).every(
        (r: any) => r.connected && r.revision === 1,
      ),
    ).toBe(true);
    await saveSecrets({ instagramClientSecret: 'changed' });
    expect((await row('instagram')).connected).toBe(false);
    expect((await row('threads')).connected).toBe(true);
    expect((await row('x')).connected).toBe(true);
    const visible = await marketing.settings(WORKSPACE_ID);
    expect(visible.configured.instagramClientSecret).toBe(true);
    expect(JSON.stringify(visible)).not.toContain('changed');
    vi.stubEnv('INSTAGRAM_CLIENT_ID', 'environment-fallback');
    await saveSecrets({}, ['instagramClientId']);
    expect((await marketing.settings(WORKSPACE_ID)).configured.instagramClientId).toBe(false);
    await expect(start()).rejects.toMatchObject({ status: 400 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each(['instagram', 'threads'] as const)(
    'serializes %s long-lived refresh without changing revision',
    async (channel) => {
      const p = await store.project(WORKSPACE_ID, 'mellow'),
        context = `channel:${WORKSPACE_ID}:${p.id}:${channel}`;
      await db.query(
        `INSERT INTO channel_connections ("workspaceId","projectId",channel,ciphertext,revision,"expiresAt") VALUES ($1,$2,$3,$4,1,now()+interval '2 days')`,
        [
          WORKSPACE_ID,
          p.id,
          channel,
          seal({ token: 'old', longLived: true, issuedAt: Date.now() - 58 * 86400000 }, context),
        ],
      );
      const fetch = vi.fn(async () => json({ access_token: 'refreshed', expires_in: 5184000 }));
      vi.stubGlobal('fetch', fetch);
      expect(
        await Promise.all([1, 2].map(() => marketing.connectionToken(WORKSPACE_ID, p.id, channel, 1))),
      ).toEqual(['refreshed', 'refreshed']);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((await row(channel)).revision).toBe(1);
      await db.query(`UPDATE channel_connections SET "expiresAt"=now()-interval '1 second'`);
      await expect(marketing.connectionToken(WORKSPACE_ID, p.id, channel, 1)).rejects.toMatchObject({
        status: 400,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it('retains X PKCE and completes legacy pending X authorization', async () => {
    const url = await start('x'),
      state = url.searchParams.get('state')!;
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const [attempt] = await db.query('SELECT * FROM channel_oauth');
    const pending = unseal<any>(attempt.ciphertext, `oauth:${attempt.hash}`);
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(pending.verifier).digest('base64url'),
    );
    delete pending.channel;
    await db.query('UPDATE channel_oauth SET ciphertext=$1', [seal(pending, `oauth:${attempt.hash}`)]);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          access_token: 'x-access',
          refresh_token: 'x-refresh',
          token_type: 'bearer',
          expires_in: 7200,
          scope: X_SCOPES.join(' '),
        }),
      )
      .mockResolvedValueOnce(json({ data: { id: '123456', username: 'mellow_test' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await marketing.completeX(WORKSPACE_ID, actor, state, 'code')).toBe('mellow');
    expect((await row('x')).connected).toBe(true);
  });
  it('accepts all Meta settings and rejects unknown fields', async () => {
    const { configured, encryptionReady, updatedAt, ...s } = await marketing.settings(WORKSPACE_ID);
    expect(integrationInput.safeParse({ ...s, secrets, clear: [] }).success).toBe(true);
    expect(integrationInput.safeParse({ ...s, secrets: { metaAccessToken: 'bad' }, clear: [] }).success).toBe(
      false,
    );
    const fake = randomBytes(32).toString('base64url');
    expect(oauthHash('instagram', fake)).not.toBe(oauthHash('threads', fake));
  });
});
