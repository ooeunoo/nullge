import sharp from 'sharp';
/** Resized image variants keyed by asset id and width; assets are immutable so entries never go stale. */
const thumbnails = new Map<string, Buffer>();
import { randomBytes, randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  secretFields,
  type Channel,
  type IntegrationInput,
  type Integrations,
  type GenerationInput,
  type GenerationQuote,
  type BufferChannel,
} from '@nullge/contracts';
import { Store, StoreError } from './store';
import { HISTORY_BYTES, PLANNING_OUTPUT_TOKENS } from './marketing-history';
import { encryptionReady, seal, unseal, referenceImage } from './marketing-security';
import {
  providerJson,
  socialIdentity,
  xTokens,
  planInstructions,
  type Credentials,
} from './marketing-providers';
import {
  authorizeUrl,
  metaTokens,
  oauthApp,
  oauthHash,
  oauthKeys,
  refreshMetaTokens,
  type SocialTokens,
} from './marketing-oauth';
import { getBufferChannel, listBufferChannels } from './marketing-buffer';
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const envNames: Record<string, string> = {
  openaiKey: 'OPENAI_API_KEY',
  higgsfieldKey: 'HIGGSFIELD_API_KEY',
  higgsfieldSecret: 'HIGGSFIELD_API_SECRET',
  xClientId: 'X_CLIENT_ID',
  xClientSecret: 'X_CLIENT_SECRET',
  instagramClientId: 'INSTAGRAM_CLIENT_ID',
  instagramClientSecret: 'INSTAGRAM_CLIENT_SECRET',
  threadsClientId: 'THREADS_CLIENT_ID',
  threadsClientSecret: 'THREADS_CLIENT_SECRET',
  bufferApiKey: 'BUFFER_API_KEY',
};
export class MarketingStore {
  readonly store: Store;
  constructor(readonly db: DataSource) {
    this.store = new Store(db);
  }
  async settingsRow(workspaceId: string, manager = this.db.manager, lock = false) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    await manager.query(
      'INSERT INTO integrations ("workspaceId","openaiModel","openaiInputUsd","openaiOutputUsd") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [workspaceId, model, model === 'gpt-4o-mini' ? 0.15 : null, model === 'gpt-4o-mini' ? 0.6 : null],
    );
    const [row] = await manager.query(
      `SELECT * FROM integrations WHERE "workspaceId"=$1${lock ? ' FOR UPDATE' : ''}`,
      [workspaceId],
    );
    return row;
  }
  credentials(row: any): Credentials {
    const saved = unseal<Record<string, string | null>>(row.ciphertext, `settings:${row.workspaceId}`),
      result: Credentials = {};
    for (const name of secretFields) {
      const value = Object.hasOwn(saved, name) ? saved[name] : process.env[envNames[name]!];
      if (value) result[name] = value;
    }
    return result;
  }
  async settings(workspaceId: string): Promise<Integrations> {
    const r = await this.settingsRow(workspaceId),
      c = this.credentials(r);
    return {
      revision: r.revision,
      openaiModel: r.openaiModel,
      openaiInputUsd: r.openaiInputUsd === null ? null : Number(r.openaiInputUsd),
      openaiOutputUsd: r.openaiOutputUsd === null ? null : Number(r.openaiOutputUsd),
      imageUsd: r.imageUsd === null ? null : Number(r.imageUsd),
      videoUsd: r.videoUsd === null ? null : Number(r.videoUsd),
      configured: Object.fromEntries(secretFields.map((k) => [k, !!c[k]])) as Integrations['configured'],
      encryptionReady: encryptionReady(),
      updatedAt: r.updatedAt?.toISOString() || null,
    };
  }
  async saveSettings(workspaceId: string, actorId: string, input: IntegrationInput) {
    await this.db.transaction(async (m) => {
      const r = await this.settingsRow(workspaceId, m, true);
      if (r.revision !== input.revision)
        throw new StoreError(409, '설정이 변경되었습니다. 새로고침해 주세요.');
      const c = unseal<Record<string, string | null>>(r.ciphertext, `settings:${workspaceId}`);
      const before = this.credentials(r);
      Object.assign(c, input.secrets);
      for (const k of input.clear) c[k] = null;
      if (await this.hasActive(workspaceId, m))
        throw new StoreError(409, '진행 중인 생성 작업이 끝난 뒤 공통 설정을 변경해 주세요.');
      await m.query(
        'UPDATE integrations SET revision=revision+1,ciphertext=$2,"openaiModel"=$3,"openaiInputUsd"=$4,"openaiOutputUsd"=$5,"imageUsd"=$6,"videoUsd"=$7,"updatedAt"=now() WHERE "workspaceId"=$1',
        [
          workspaceId,
          seal(c, `settings:${workspaceId}`),
          input.openaiModel,
          input.openaiInputUsd,
          input.openaiOutputUsd,
          input.imageUsd,
          input.videoUsd,
        ],
      );
      const after = this.credentials({ ...r, ciphertext: seal(c, `settings:${workspaceId}`) });
      for (const channel of ['x', 'threads', 'instagram'] as const) {
        if (!oauthKeys[channel].some((key) => before[key] !== after[key])) continue;
        await m.query('DELETE FROM channel_oauth WHERE "workspaceId"=$1', [workspaceId]);
        await m.query(
          `UPDATE channel_connections SET ciphertext=NULL,"userId"=NULL,username=NULL,"verifiedAt"=NULL,"expiresAt"=NULL,revision=revision+1 WHERE "workspaceId"=$1 AND channel=$2 AND provider='direct'`,
          [workspaceId, channel],
        );
      }
      if (before.bufferApiKey !== after.bufferApiKey) {
        await m.query(
          `UPDATE channel_connections SET provider='direct',ciphertext=NULL,"userId"=NULL,username=NULL,"verifiedAt"=NULL,"expiresAt"=NULL,revision=revision+1 WHERE "workspaceId"=$1 AND provider='buffer'`,
          [workspaceId],
        );
      }
      await m.query(
        'INSERT INTO integration_events (id,"workspaceId","actorId",action) VALUES ($1,$2,$3,$4)',
        [randomUUID(), workspaceId, actorId, 'settings_updated'],
      );
    });
    return this.settings(workspaceId);
  }
  async hasActive(w: string, m = this.db.manager) {
    const [r] = await m.query(
      `SELECT (SELECT count(*) FROM generation_jobs WHERE "workspaceId"=$1 AND status IN ('queued','planning','submitting','rendering'))+(SELECT count(*) FROM publication_jobs WHERE "workspaceId"=$1 AND status IN ('queued','creating','processing','submitting')) n`,
      [w],
    );
    return Number(r.n) > 0;
  }
  async verifyOpenAI(w: string) {
    const r = await this.settingsRow(w),
      c = this.credentials(r);
    if (!c.openaiKey) throw new StoreError(400, 'OpenAI API 키를 먼저 저장해 주세요.');
    await providerJson(
      `https://api.openai.com/v1/models/${encodeURIComponent(r.openaiModel)}`,
      `Bearer ${c.openaiKey}`,
    );
    return {
      message: 'API 키와 모델 접근을 확인했어요. 유료 생성은 실행하지 않았어요.',
    };
  }
  async connections(w: string, slug: string) {
    const p = await this.store.project(w, slug);
    const rows = await this.db.query(
      'SELECT channel,provider,revision,"userId",username,"verifiedAt","expiresAt",(ciphertext IS NOT NULL) connected FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2',
      [w, p.id],
    );
    return clean(
      (['x', 'threads', 'instagram'] as const).map(
        (channel) =>
          rows.find((r: any) => r.channel === channel) || {
            channel,
            provider: 'direct',
            revision: 0,
            userId: null,
            username: null,
            verifiedAt: null,
            expiresAt: null,
            connected: false,
          },
      ),
    );
  }
  async bufferChannels(w: string): Promise<BufferChannel[]> {
    const settings = await this.settingsRow(w);
    const apiKey = this.credentials(settings).bufferApiKey;
    if (!apiKey) throw new StoreError(400, '공통 설정에서 Buffer API 키를 먼저 등록해 주세요.');
    return listBufferChannels(apiKey);
  }
  async connectBuffer(
    w: string,
    slug: string,
    channel: Channel,
    actorId: string,
    revision: number,
    channelId: string,
  ) {
    const settings = await this.settingsRow(w);
    const apiKey = this.credentials(settings).bufferApiKey;
    if (!apiKey) throw new StoreError(400, '공통 설정에서 Buffer API 키를 먼저 등록해 주세요.');
    const remote = await getBufferChannel(apiKey, channelId);
    if (remote.service !== channel)
      throw new StoreError(400, '선택한 Buffer 채널의 SNS 종류가 일치하지 않습니다.');
    const p = await this.store.project(w, slug);
    await this.db.transaction(async (m) => {
      const row = await this.connectionRow(w, p.id, channel, m);
      if (row.revision !== revision)
        throw new StoreError(409, '연결 정보가 변경되었습니다. 새로고침해 주세요.');
      await m.query(
        `UPDATE channel_connections SET provider='buffer',ciphertext=$4,"userId"=$5,username=$6,"verifiedAt"=now(),"expiresAt"=NULL,revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3`,
        [
          w,
          p.id,
          channel,
          seal({ channelId: remote.id }, `channel:${w}:${p.id}:${channel}`),
          remote.id,
          remote.name,
        ],
      );
      await this.event(m, w, p.id, actorId, `${channel} Buffer 채널 연결`);
    });
    return { message: `Buffer의 @${remote.name} 계정을 연결했어요.` };
  }
  private async connectionRow(w: string, p: string, channel: Channel, m: EntityManager) {
    await m.query('SELECT id FROM projects WHERE "workspaceId"=$1 AND id=$2 FOR UPDATE', [w, p]);
    const [active] = await m.query(
      `SELECT count(*)::int n FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 AND "publishStatus" IN ('queued','creating','processing','submitting')`,
      [w, p, channel],
    );
    if (active.n) throw new StoreError(409, '게시 작업이 완료된 뒤 채널 연결을 변경해 주세요.');
    await m.query(
      'INSERT INTO channel_connections ("workspaceId","projectId",channel) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [w, p, channel],
    );
    const [r] = await m.query(
      'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 FOR UPDATE',
      [w, p, channel],
    );
    return r;
  }
  async connect(w: string, slug: string, channel: Channel, actorId: string, revision: number, token: string) {
    if (channel === 'x') throw new StoreError(400, 'X는 OAuth 연결 버튼을 사용해 주세요.');
    const p = await this.store.project(w, slug);
    const identity = await socialIdentity(channel, token);
    await this.db.transaction(async (m) => {
      const row = await this.connectionRow(w, p.id, channel, m);
      if (row.revision !== revision)
        throw new StoreError(409, '채널 설정이 변경되었습니다. 새로고침해 주세요.');
      await m.query(
        `UPDATE channel_connections SET provider='direct',ciphertext=$4,"userId"=$5,username=$6,"verifiedAt"=now(),revision=revision+1,"expiresAt"=NULL WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3`,
        [
          w,
          p.id,
          channel,
          seal({ token }, `channel:${w}:${p.id}:${channel}`),
          identity.id,
          identity.username,
        ],
      );
      await this.event(m, w, p.id, actorId, `${channel} 계정 연결`);
    });
    return this.connections(w, slug);
  }
  async disconnect(w: string, slug: string, channel: Channel, actorId: string, revision: number) {
    const p = await this.store.project(w, slug);
    await this.db.transaction(async (m) => {
      const r = await this.connectionRow(w, p.id, channel, m);
      if (r.revision !== revision) throw new StoreError(409, '채널 설정이 변경되었습니다.');
      await m.query(
        `UPDATE channel_connections SET provider='direct',ciphertext=NULL,"userId"=NULL,username=NULL,"verifiedAt"=NULL,"expiresAt"=NULL,revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3`,
        [w, p.id, channel],
      );
      await m.query('DELETE FROM channel_oauth WHERE "workspaceId"=$1 AND "projectId"=$2', [w, p.id]);
      await this.event(m, w, p.id, actorId, `${channel} 연결 해제`);
    });
    return this.connections(w, slug);
  }
  async verifyConnection(w: string, slug: string, channel: Channel, revision: number) {
    const p = await this.store.project(w, slug);
    const [current] = await this.db.query(
      'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
      [w, p.id, channel],
    );
    if (!current?.ciphertext || current.revision !== revision)
      throw new StoreError(409, '연결 정보를 새로 확인해 주세요.');
    if (current.provider === 'buffer') {
      const settings = await this.settingsRow(w),
        apiKey = this.credentials(settings).bufferApiKey;
      if (!apiKey) throw new StoreError(400, '공통 Buffer API 키가 없습니다.');
      const stored = unseal<{ channelId: string }>(current.ciphertext, `channel:${w}:${p.id}:${channel}`);
      const remote = await getBufferChannel(apiKey, stored.channelId);
      if (remote.service !== channel || remote.id !== current.userId)
        throw new StoreError(400, 'Buffer 채널 연결이 변경되었습니다.');
      return this.db.transaction(async (m) => {
        const row = await this.connectionRow(w, p.id, channel, m);
        if (row.revision !== revision || row.provider !== 'buffer' || row.userId !== remote.id)
          throw new StoreError(409, '연결 정보를 새로 확인해 주세요.');
        await m.query(
          'UPDATE channel_connections SET "verifiedAt"=now(),username=$4,revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
          [w, p.id, channel, remote.name],
        );
        return { message: `Buffer의 @${remote.name} 연결을 확인했어요.` };
      });
    }
    const token = await this.connectionToken(w, p.id, channel, revision);
    return this.db.transaction(async (m) => {
      const r = await this.connectionRow(w, p.id, channel, m);
      if (r.revision !== revision || !r.ciphertext)
        throw new StoreError(409, '연결 정보를 새로 확인해 주세요.');
      if (r.expiresAt && new Date(r.expiresAt).getTime() < Date.now())
        throw new StoreError(400, '인증이 만료되었습니다. 다시 연결해 주세요.');
      const identity = await socialIdentity(channel, token);
      if (identity.id !== r.userId) throw new StoreError(400, '연결 계정이 다릅니다. 다시 연결해 주세요.');
      await m.query(
        'UPDATE channel_connections SET "verifiedAt"=now(),username=$4,revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
        [w, p.id, channel, identity.username],
      );
      return {
        message: '계정 접근을 확인했어요. 게시 권한은 실제 게시 시 별도로 확인돼요.',
      };
    });
  }
  async connectionToken(w: string, p: string, channel: Channel, revision: number): Promise<string> {
    return this.db.transaction(async (m) => {
      const settings = await this.settingsRow(w, m, true);
      const [r] = await m.query(
        'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 FOR UPDATE',
        [w, p, channel],
      );
      if (!r?.ciphertext || r.revision !== revision)
        throw new StoreError(409, 'SNS 연결이 변경되었습니다. 다시 확인해 주세요.');
      if (r.provider === 'buffer')
        throw new StoreError(400, 'Buffer 연결에는 직접 SNS 토큰을 사용할 수 없습니다.');
      const context = `channel:${w}:${p}:${channel}`;
      let c = unseal<SocialTokens>(r.ciphertext, context);
      const expires = r.expiresAt ? new Date(r.expiresAt).getTime() : Infinity;
      const refreshX = channel === 'x' && expires < Date.now() + 60000;
      const refreshMeta =
        channel !== 'x' &&
        c.longLived &&
        expires > Date.now() &&
        expires < Date.now() + 7 * 86400000 &&
        !!c.issuedAt &&
        c.issuedAt < Date.now() - 86400000;
      if (refreshX || refreshMeta) {
        try {
          if (channel === 'x') {
            if (!c.refreshToken) throw new Error('Missing refresh token');
            c = await xTokens(
              this.credentials(settings),
              { grant_type: 'refresh_token', refresh_token: c.refreshToken },
              c.refreshToken,
            );
          } else c = await refreshMetaTokens(channel, c.token);
        } catch {
          throw new StoreError(400, 'SNS 인증 갱신에 실패했습니다. 채널에서 계정을 다시 연결해 주세요.');
        }
        await m.query(
          'UPDATE channel_connections SET ciphertext=$4,"expiresAt"=$5 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
          [w, p, channel, seal(c, context), c.expiresAt],
        );
      } else if (expires <= Date.now()) {
        throw new StoreError(400, 'SNS 인증이 만료되었습니다. 다시 연결해 주세요.');
      }
      return c.token;
    });
  }
  async bufferPublishingCredentials(w: string, p: string, channel: Channel, revision: number) {
    const [row] = await this.db.query(
      'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',
      [w, p, channel],
    );
    if (!row?.ciphertext || row.revision !== revision || row.provider !== 'buffer')
      throw new StoreError(409, 'Buffer 채널 연결이 변경되었습니다.');
    const settings = await this.settingsRow(w),
      apiKey = this.credentials(settings).bufferApiKey;
    if (!apiKey) throw new StoreError(400, '공통 Buffer API 키가 없습니다.');
    const { channelId } = unseal<{ channelId: string }>(row.ciphertext, `channel:${w}:${p}:${channel}`);
    if (!channelId || channelId !== row.userId)
      throw new StoreError(400, 'Buffer 채널 정보를 확인할 수 없습니다.');
    return { apiKey, channelId };
  }
  beginX(w: string, slug: string, actorId: string, revision: number, origin: string) {
    return this.beginOAuth(w, slug, 'x', actorId, revision, origin);
  }
  async beginOAuth(
    w: string,
    slug: string,
    channel: Channel,
    actorId: string,
    revision: number,
    origin: string,
  ) {
    const p = await this.store.project(w, slug);
    return this.db.transaction(async (m) => {
      const s = await this.settingsRow(w, m, true),
        c = this.credentials(s);
      oauthApp(channel, c);
      const r = await this.connectionRow(w, p.id, channel, m);
      if (r.revision !== revision) throw new StoreError(409, '채널 정보를 새로고침해 주세요.');
      const state = randomBytes(32).toString('base64url'),
        verifier = randomBytes(48).toString('base64url'),
        hash = oauthHash(channel, state);
      const redirectUri = `${origin}/api/channels/${channel}/callback`;
      await m.query(
        'DELETE FROM channel_oauth WHERE "expiresAt"<now() OR ("workspaceId"=$1 AND "projectId"=$2)',
        [w, p.id],
      );
      await m.query(
        `INSERT INTO channel_oauth (hash,"workspaceId","projectId","actorId",revision,"settingsRevision",ciphertext,"expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')`,
        [
          hash,
          w,
          p.id,
          actorId,
          r.revision,
          s.revision,
          seal({ channel, verifier, redirectUri }, `oauth:${hash}`),
        ],
      );
      return { url: authorizeUrl(channel, c, redirectUri, state, verifier) };
    });
  }
  async completeX(w: string, actorId: string, state: string, code: string) {
    return (await this.completeOAuth(w, actorId, 'x', state, code)).slug;
  }
  async completeOAuth(
    w: string,
    actorId: string,
    channel: Channel,
    state: string,
    code: string,
    denied = false,
  ) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new StoreError(400, 'SNS 인증 응답이 올바르지 않습니다.');
    const [attempt] = await this.db.query(
      'WITH claimed AS (DELETE FROM channel_oauth WHERE hash=$1 AND "workspaceId"=$2 AND "actorId"=$3 AND "expiresAt">now() RETURNING *) SELECT * FROM claimed',
      [oauthHash(channel, state), w, actorId],
    );
    if (!attempt) throw new StoreError(400, 'SNS 인증이 만료되었거나 이미 사용되었습니다.');
    const pending = unseal<{ channel?: Channel; verifier: string; redirectUri: string }>(
      attempt.ciphertext,
      `oauth:${attempt.hash}`,
    );
    if ((pending.channel || 'x') !== channel)
      throw new StoreError(400, 'SNS 인증 서비스가 일치하지 않습니다.');
    const [p] = await this.db.query('SELECT slug FROM projects WHERE id=$1 AND "workspaceId"=$2', [
      attempt.projectId,
      w,
    ]);
    if (denied) return { slug: p.slug as string, connected: false };
    if (!code || code.length > 2048) throw new StoreError(400, 'SNS 인증 코드가 올바르지 않습니다.');
    // Check revisions before exchanging a code and again before saving its result.
    const s = await this.db.transaction(async (m) => {
      const settings = await this.settingsRow(w, m, true),
        r = await this.connectionRow(w, attempt.projectId, channel, m);
      if (settings.revision !== attempt.settingsRevision || r.revision !== attempt.revision)
        throw new StoreError(409, '연결 설정이 변경되었습니다. 다시 연결해 주세요.');
      return settings;
    });
    const tokens =
      channel === 'x'
        ? await xTokens(this.credentials(s), {
            grant_type: 'authorization_code',
            code,
            redirect_uri: pending.redirectUri,
            code_verifier: pending.verifier,
          })
        : await metaTokens(channel, this.credentials(s), code, pending.redirectUri);
    const identity = await socialIdentity(channel, tokens.token);
    await this.db.transaction(async (m) => {
      const latest = await this.settingsRow(w, m, true),
        r = await this.connectionRow(w, attempt.projectId, channel, m);
      if (latest.revision !== attempt.settingsRevision || r.revision !== attempt.revision)
        throw new StoreError(409, '연결 설정이 변경되었습니다. 다시 연결해 주세요.');
      await m.query(
        `UPDATE channel_connections SET provider='direct',ciphertext=$4,"userId"=$5,username=$6,"expiresAt"=$7,"verifiedAt"=now(),revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3`,
        [
          w,
          attempt.projectId,
          channel,
          seal(tokens, `channel:${w}:${attempt.projectId}:${channel}`),
          identity.id,
          identity.username,
          tokens.expiresAt,
        ],
      );
      await this.event(m, w, attempt.projectId, actorId, `${channel} OAuth 계정 연결`);
    });
    return { slug: p.slug as string, connected: true };
  }
  async quote(w: string, slug: string, actorId: string, input: GenerationInput): Promise<GenerationQuote> {
    referenceImage(input.reference);
    const p = await this.store.project(w, slug),
      s = await this.settingsRow(w),
      c = this.credentials(s);
    if (!c.openaiKey) throw new StoreError(400, '공통 설정에서 OpenAI API를 연결해 주세요.');
    if (input.format !== 'text' && (!c.higgsfieldKey || !c.higgsfieldSecret))
      throw new StoreError(400, '공통 설정에서 Higgsfield API를 연결해 주세요.');
    if (!s.openaiInputUsd || !s.openaiOutputUsd || (input.format !== 'text' && !s[`${input.format}Usd`]))
      throw new StoreError(
        400,
        '공통 설정에서 공급자의 현재 단가를 입력해 주세요. 비용 확인 전에는 생성하지 않습니다.',
      );
    if (input.format !== 'text' && !process.env.HIGGSFIELD_MEDIA_HOSTS?.trim())
      throw new StoreError(
        503,
        '생성 결과를 안전하게 저장할 CDN 허용 목록 설정이 필요합니다. 비용이 발생하는 요청은 보내지 않았습니다.',
      );
    const inputTokens =
        Buffer.byteLength(planInstructions(p, true) + JSON.stringify(input.prompt)) +
        HISTORY_BYTES +
        2048 +
        (input.reference ? 4096 : 0),
      textCost =
        (inputTokens * Number(s.openaiInputUsd) + PLANNING_OUTPUT_TOKENS * Number(s.openaiOutputUsd)) / 1e6;
    const lines = [
      {
        label: `OpenAI ${s.openaiModel} · 제품·이력 분석 + 후보 기획 (출력 최대 ${PLANNING_OUTPUT_TOKENS.toLocaleString('en-US')} 토큰)`,
        usd: Math.ceil(textCost * 1e4) / 1e4,
      },
    ];
    if (input.format !== 'text')
      lines.push({
        label: input.format === 'image' ? 'Higgsfield 이미지 1장' : 'Higgsfield 5초 영상 1개',
        usd: Number(s[`${input.format}Usd`]),
      });
    const totalUsd = Math.ceil(lines.reduce((n, l) => n + l.usd, 0) * 1e4) / 1e4,
      id = randomUUID(),
      expiresAt = new Date(Date.now() + 600000).toISOString();
    return this.db.transaction(async (m) => {
      await this.store.project(w, slug, m, true);
      // Automatic estimates reuse an unchanged quote; only explicit confirmation queues work.
      const [existing] = await m.query(
        `SELECT * FROM generation_jobs WHERE "workspaceId"=$1 AND "projectId"=$2 AND "actorId"=$3
          AND status='quoted' AND "quoteExpiresAt">now()+interval '30 seconds'
          AND prompt=$4 AND format=$5 AND channel=$6 AND language=$7
          AND reference IS NOT DISTINCT FROM $8 AND "profileRevision"=$9 AND "settingsRevision"=$10
          AND snapshot->>'plannerVersion'='2' ORDER BY "createdAt" DESC LIMIT 1`,
        [
          w,
          p.id,
          actorId,
          input.prompt,
          input.format,
          input.channel,
          input.language,
          input.reference || null,
          p.revision,
          s.revision,
        ],
      );
      if (existing)
        return {
          id: existing.id,
          totalUsd: Number(existing.estimatedUsd),
          lines: existing.snapshot.lines,
          expiresAt: new Date(existing.quoteExpiresAt).toISOString(),
          model: existing.snapshot.model,
          format: input.format,
        };
      const [count] = await m.query(
        `SELECT count(*)::int n FROM generation_jobs WHERE "workspaceId"=$1 AND status='quoted' AND "createdAt">now()-interval '1 hour'`,
        [w],
      );
      if (count.n >= 50) throw new StoreError(429, '비용 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      await m.query(
        `INSERT INTO generation_jobs (id,"workspaceId","projectId","actorId",prompt,format,channel,language,reference,"profileRevision","settingsRevision",snapshot,"estimatedUsd","quoteExpiresAt",status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'quoted')`,
        [
          id,
          w,
          p.id,
          actorId,
          input.prompt,
          input.format,
          input.channel,
          input.language,
          input.reference || null,
          p.revision,
          s.revision,
          JSON.stringify({ project: p, model: s.openaiModel, lines, plannerVersion: 2 }),
          totalUsd,
          expiresAt,
        ],
      );
      return { id, totalUsd, lines, expiresAt, model: s.openaiModel, format: input.format };
    });
  }
  async confirm(w: string, slug: string, actorId: string, id: string) {
    return this.db.transaction(async (m) => {
      const s = await this.settingsRow(w, m, true),
        p = await this.store.project(w, slug, m, true);
      const [j] = await m.query(
        'SELECT * FROM generation_jobs WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3 AND "actorId"=$4 FOR UPDATE',
        [id, w, p.id, actorId],
      );
      if (!j) throw new StoreError(404, '생성 요청을 찾을 수 없습니다.');
      if (j.confirmedAt) return { id: j.id };
      if (
        j.status !== 'quoted' ||
        new Date(j.quoteExpiresAt).getTime() < Date.now() ||
        j.profileRevision !== p.revision ||
        j.settingsRevision !== s.revision
      )
        throw new StoreError(409, '비용 확인이 만료되었거나 설정이 변경되었습니다. 다시 확인해 주세요.');
      const [n] = await m.query(
        `SELECT count(*)::int n FROM generation_jobs WHERE "workspaceId"=$1 AND "confirmedAt">now()-interval '24 hours'`,
        [w],
      );
      if (n.n >= 20) throw new StoreError(429, '안전 한도: 24시간당 20건까지 생성할 수 있어요.');
      await m.query(
        `UPDATE generation_jobs SET status='queued',"confirmedAt"=now(),"updatedAt"=now() WHERE id=$1`,
        [id],
      );
      await this.event(m, w, p.id, actorId, '비용 확인 후 자동 생성 요청');
      return { id };
    });
  }
  async jobs(w: string, slug: string) {
    const p = await this.store.project(w, slug);
    return clean(
      await this.db.query(
        `SELECT id,"projectId",prompt,result->>'title' title,format,channel,status,error,"postId","createdAt","updatedAt","estimatedUsd"::float FROM generation_jobs WHERE "workspaceId"=$1 AND "projectId"=$2 AND status<>'quoted' ORDER BY "createdAt" DESC LIMIT 30`,
        [w, p.id],
      ),
    );
  }
  async asset(w: string, id: string, width?: number): Promise<{ mime: string; content: Buffer }> {
    const [r] = await this.db.query(
      'SELECT mime,content FROM marketing_assets WHERE "workspaceId"=$1 AND id=$2',
      [w, id],
    );
    if (!r) throw new StoreError(404, '미디어가 없습니다.');
    if (!width || !String(r.mime).startsWith('image/')) return r;
    const key = `${id}:${width}`,
      hit = thumbnails.get(key);
    if (hit) return { mime: 'image/jpeg', content: hit };
    const content = await sharp(r.content)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (thumbnails.size > 400) thumbnails.delete(thumbnails.keys().next().value as string);
    thumbnails.set(key, content);
    return { mime: 'image/jpeg', content };
  }
  async event(m: EntityManager, w: string, p: string, actor: string, title: string) {
    await m.query(
      'INSERT INTO events (id,"workspaceId","projectId","actorId",action,title) VALUES ($1,$2,$3,$4,$5,$6)',
      [randomUUID(), w, p, actor, 'marketing_action', title],
    );
  }
}
