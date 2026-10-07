import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  CHANNEL_LABELS,
  LANGUAGE_LABELS,
  type Channel,
  type Language,
  type Post,
  type Project,
} from '@nullge/contracts';
import { Store, StoreError } from './store';
import { unseal } from './marketing-security';
import { MarketingStore, channelContext } from './marketing-store';
import { bufferPost, createBufferPost } from './marketing-buffer';
import { providerJson, socialIdentity, ProviderError } from './marketing-providers';
export function validatePublish(post: Post) {
  if (!post.caption.trim()) throw new StoreError(400, '게시 문구가 비어 있습니다.');
  if (/실제\s*(발행|게시)\s*금지/.test(post.caption + ' ' + post.brief))
    throw new StoreError(400, '실제 게시 금지로 표시된 테스트 콘텐츠입니다.');
  const format = post.format || 'text';
  if (format !== 'text' && !post.assetId) throw new StoreError(400, '완성된 미디어가 필요합니다.');
  if (post.channel === 'instagram' && format === 'text')
    throw new StoreError(400, 'Instagram에는 이미지나 영상이 필요합니다.');
  if (post.channel !== 'instagram' && format === 'video')
    throw new StoreError(
      400,
      '영상의 직접 게시는 Instagram만 지원해요. 다른 채널은 원본을 내려받아 게시해 주세요.',
    );
  const count = Array.from(post.caption).reduce(
    (n, c) => n + (post.channel === 'x' && c.codePointAt(0)! > 0x10ff ? 2 : 1),
    0,
  );
  if (count > { x: 280, threads: 500, instagram: 2200 }[post.channel])
    throw new StoreError(400, '채널의 문구 길이 제한을 초과합니다.');
}
function signature(w: string, id: string, expires: string) {
  const key = process.env.MARKETING_SECRET_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new StoreError(503, '미디어 서명 키가 없습니다.');
  return createHmac('sha256', Buffer.from(key, 'hex'))
    .update(`nullge-public-media:${w}:${id}:${expires}`)
    .digest('hex');
}
export function signedAssetUrl(w: string, id: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 86400),
    base = process.env.CONSOLE_ORIGIN;
  if (!base?.startsWith('https://'))
    throw new StoreError(400, 'SNS 미디어 게시에는 공개 HTTPS 콘솔 주소가 필요합니다.');
  return `${base}/api/public-assets/${id}?workspace=${w}&expires=${expires}&signature=${signature(w, id, expires)}`;
}
export function checkAssetSignature(w: string, id: string, expires: string, sig: string) {
  if (
    !/^\d{10}$/.test(expires) ||
    Number(expires) < Date.now() / 1000 ||
    Number(expires) > Date.now() / 1000 + 86460 ||
    !/^[-a-f0-9]{36}$/.test(w) ||
    !/^[a-f0-9]{64}$/.test(sig) ||
    !timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(signature(w, id, expires), 'hex'))
  )
    throw new StoreError(403, '미디어 링크가 만료되었거나 유효하지 않습니다.');
}
export class MarketingPublisher {
  private store: Store;
  constructor(readonly db: DataSource) {
    this.store = new Store(db);
  }
  /**
   * Every check a publication needs, shared by "publish now" and scheduling so a schedule can never pass a post
   * that publishing would refuse.
   */
  private async publishable(m: EntityManager, w: string, p: Project, post: any, connectionRevision: number) {
    if (post.publishStatus)
      throw new StoreError(409, '이미 게시 요청이 기록되어 있습니다. 중복 게시하지 않습니다.');
    if (
      post.status !== 'approved' ||
      !post.approvedAt ||
      !p.profileReviewedAt ||
      p.revision !== post.profileRevision
    )
      throw new StoreError(400, '최신 제품 정보와 콘텐츠 검토를 먼저 완료해 주세요.');
    validatePublish(post);
    const [c] = await m.query(
      'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 AND language=$4 FOR UPDATE',
      [w, p.id, post.channel, post.language],
    );
    // A post goes only to the account of its own language, never to another language's account.
    if (!c?.ciphertext)
      throw new StoreError(
        400,
        `${LANGUAGE_LABELS[post.language as Language]} ${CHANNEL_LABELS[post.channel as Channel]} 계정을 먼저 연결해 주세요.`,
      );
    if (c.revision !== connectionRevision) throw new StoreError(409, '게시할 계정을 다시 확인해 주세요.');
    if (
      c.expiresAt &&
      new Date(c.expiresAt).getTime() < Date.now() + 60000 &&
      !(
        post.channel === 'x' &&
        unseal<{ refreshToken?: string }>(c.ciphertext, channelContext(w, p.id, 'x', post.language))
          .refreshToken
      )
    )
      throw new StoreError(400, 'SNS 인증이 만료되었거나 곧 만료됩니다. 채널에서 다시 인증해 주세요.');
    let aiGenerated: boolean | undefined;
    if (post.assetId) {
      const [a] = await m.query(
        'SELECT mime,"jobId",octet_length(content) size FROM marketing_assets WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3',
        [post.assetId, w, p.id],
      );
      if (!a) throw new StoreError(400, '미디어를 확인할 수 없습니다.');
      aiGenerated = !!a.jobId;
      if (post.channel === 'instagram' && post.format === 'image' && a.mime !== 'image/jpeg')
        throw new StoreError(
          400,
          'Instagram 직접 게시 이미지는 JPEG여야 합니다. 원본을 변환한 뒤 수동 게시해 주세요.',
        );
      if (post.channel === 'x' && a.size > 5 * 1024 * 1024)
        throw new StoreError(400, 'X 직접 게시 이미지는 5 MB 이하여야 합니다.');
    }
    return { c, aiGenerated };
  }
  async enqueue(
    w: string,
    slug: string,
    id: string,
    actor: string,
    revision: number,
    connectionRevision: number,
  ) {
    return this.db.transaction(async (m) => {
      await m.query('SELECT "workspaceId" FROM integrations WHERE "workspaceId"=$1 FOR UPDATE', [w]);
      const p = await this.store.project(w, slug, m, true);
      const [post] = await m.query(
        'SELECT * FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 FOR UPDATE',
        [w, p.id, id],
      );
      if (!post || post.revision !== revision)
        throw new StoreError(409, '콘텐츠가 변경되었습니다. 다시 검토해 주세요.');
      const { c, aiGenerated } = await this.publishable(m, w, p, post, connectionRevision);
      await m.query(
        `INSERT INTO publication_jobs (id,"workspaceId","projectId","postId","actorId","connectionRevision",snapshot,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'queued')`,
        [
          randomUUID(),
          w,
          p.id,
          id,
          actor,
          c.revision,
          JSON.stringify({
            ...post,
            aiGenerated,
            userId: c.userId,
            username: c.username,
            provider: c.provider || 'direct',
          }),
        ],
      );
      await m.query(`UPDATE posts SET "publishStatus"='queued',"updatedAt"=now() WHERE id=$1`, [id]);
      return { ok: true };
    });
  }
  /** Plans publication at a time; the schedule is bound to the post revision it was made on. */
  async schedule(
    w: string,
    slug: string,
    id: string,
    actor: string,
    revision: number,
    connectionRevision: number,
    scheduledAt: string,
    now = Date.now(),
  ): Promise<Post> {
    const at = new Date(scheduledAt).getTime();
    if (!Number.isFinite(at) || at < now - 5 * 60000)
      throw new StoreError(400, '지난 시각으로는 예약할 수 없어요. 지금 게시하거나 다른 시각을 골라 주세요.');
    if (at > now + 60 * 86400000) throw new StoreError(400, '예약은 60일 안쪽으로만 할 수 있어요.');
    return this.db.transaction(async (m) => {
      const p = await this.store.project(w, slug, m, true);
      const [post] = await m.query(
        'SELECT * FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 FOR UPDATE',
        [w, p.id, id],
      );
      if (!post || post.revision !== revision)
        throw new StoreError(409, '콘텐츠가 변경되었습니다. 새로고침해 주세요.');
      await this.publishable(m, w, p, post, connectionRevision);
      const [next] = await m.query(
        `WITH changed AS (UPDATE posts SET revision=revision+1,"scheduledAt"=$2,"scheduledBy"=$3,"scheduledRevision"=revision+1,"scheduledConnectionRevision"=$4,"publishError"=NULL,"updatedAt"=now() WHERE id=$1 RETURNING *) SELECT * FROM changed`,
        [id, new Date(at), actor, connectionRevision],
      );
      await m.query(
        'INSERT INTO events (id,"workspaceId","projectId","actorId",action,title,"postId") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), w, p.id, actor, 'post_scheduled', post.title, id],
      );
      return JSON.parse(JSON.stringify(next));
    });
  }
  async unschedule(w: string, slug: string, id: string, actor: string, revision: number): Promise<Post> {
    return this.db.transaction(async (m) => {
      const p = await this.store.project(w, slug, m, true);
      const [next] = await m.query(
        `WITH changed AS (UPDATE posts SET revision=revision+1,"scheduledAt"=NULL,"scheduledRevision"=NULL,"scheduledBy"=NULL,"scheduledConnectionRevision"=NULL,"updatedAt"=now()
         WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 AND revision=$4 AND "publishStatus" IS NULL RETURNING *) SELECT * FROM changed`,
        [w, p.id, id, revision],
      );
      if (!next)
        throw new StoreError(409, '콘텐츠가 변경되었거나 이미 게시가 시작됐어요. 새로고침해 주세요.');
      await m.query(
        'INSERT INTO events (id,"workspaceId","projectId","actorId",action,title,"postId") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), w, p.id, actor, 'post_unscheduled', next.title, id],
      );
      return JSON.parse(JSON.stringify(next));
    });
  }
  /**
   * Starts publication for schedules that are due, with the same checks as "publish now". A schedule that can no
   * longer publish is cleared and its reason recorded on the post; it is never retried on its own.
   */
  async publishDue(limit = 5) {
    const due = await this.db.query(
      `SELECT p.id,p."workspaceId",p.revision,p."scheduledBy",p."scheduledConnectionRevision",pr.slug FROM posts p
       JOIN projects pr ON pr.id=p."projectId" AND pr."workspaceId"=p."workspaceId"
       WHERE p."scheduledAt"<=now() AND p."scheduledRevision"=p.revision AND p.status='approved' AND p."publishStatus" IS NULL
       ORDER BY p."scheduledAt" LIMIT $1`,
      [limit],
    );
    for (const d of due) {
      try {
        await this.enqueue(
          d.workspaceId,
          d.slug,
          d.id,
          d.scheduledBy,
          d.revision,
          d.scheduledConnectionRevision,
        );
      } catch (e) {
        const reason =
          e instanceof StoreError && e.status === 409 && /계정/.test(e.message)
            ? '게시할 계정이 바뀌어 예약 게시를 하지 않았어요. 계정을 확인한 뒤 다시 예약해 주세요.'
            : `예약 게시를 하지 못했어요: ${e instanceof StoreError ? e.message : '알 수 없는 오류'}`;
        await this.db.query(
          `UPDATE posts SET "scheduledAt"=NULL,"scheduledRevision"=NULL,"publishError"=$2 WHERE id=$1 AND "publishStatus" IS NULL`,
          [d.id, reason],
        );
      }
    }
    return due.length;
  }
  private async state(
    j: any,
    status: string,
    extra?: {
      containerId?: string;
      remoteId?: string;
      url?: string;
      error?: string;
    },
  ) {
    await this.db.transaction(async (m) => {
      await m.query(
        'UPDATE publication_jobs SET status=$2,"containerId"=COALESCE($3,"containerId"),"remoteId"=COALESCE($4,"remoteId"),"updatedAt"=now() WHERE id=$1',
        [j.id, status, extra?.containerId || null, extra?.remoteId || null],
      );
      await m.query(
        'UPDATE posts SET "publishStatus"=$2,"publishError"=$3,"publishedUrl"=$4,"updatedAt"=now() WHERE id=$1',
        [j.postId, status, extra?.error || null, extra?.url || null],
      );
    });
  }
  async tick() {
    await this.publishDue();
    const stale = await this.db.query(
      `SELECT * FROM publication_jobs WHERE status IN ('creating','submitting') AND "updatedAt"<now()-interval '5 minutes'`,
    );
    for (const j of stale)
      await this.state(j, 'uncertain', {
        error: '게시 응답을 확인하지 못했습니다. SNS 계정에서 확인해 주세요. 자동 재시도하지 않습니다.',
      });
    const j = await this.db.transaction(async (m) => {
      const [r] = await m.query(
        `SELECT * FROM publication_jobs WHERE status='queued' OR (status='processing' AND "updatedAt"<now()-interval '15 seconds') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      if (!r) return null;
      const status = r.status === 'queued' ? 'creating' : 'processing';
      await m.query('UPDATE publication_jobs SET status=$2,"updatedAt"=now() WHERE id=$1', [r.id, status]);
      await m.query('UPDATE posts SET "publishStatus"=$2 WHERE id=$1', [r.postId, status]);
      return r;
    });
    if (!j) return;
    try {
      const p = j.snapshot as Post & {
        aiGenerated?: boolean;
        userId: string;
        username: string;
        provider?: 'direct' | 'buffer';
      };
      const [c] = await this.db.query(
        'SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 AND language=$4',
        [j.workspaceId, j.projectId, p.channel, p.language],
      );
      if (
        !c?.ciphertext ||
        c.revision !== j.connectionRevision ||
        c.userId !== p.userId ||
        (c.provider || 'direct') !== (p.provider || 'direct')
      )
        throw new StoreError(400, 'SNS 연결이 변경되었거나 만료되어 게시하지 않았습니다.');
      if ((p.provider || 'direct') === 'buffer') {
        const { apiKey, channelId } = await new MarketingStore(this.db).bufferPublishingCredentials(
          j.workspaceId,
          j.projectId,
          p.channel,
          j.connectionRevision,
          p.language,
        );
        if (j.status === 'queued') {
          const mediaUrl = p.assetId ? signedAssetUrl(j.workspaceId, p.assetId) : undefined;
          await this.state(j, 'submitting');
          const result = await createBufferPost(apiKey, {
            channelId,
            channel: p.channel,
            text: p.caption,
            format: p.format || 'text',
            mediaUrl,
            aiGenerated: p.aiGenerated,
          });
          if (result.status === 'error') throw new StoreError(400, 'Buffer가 게시물을 발행하지 못했습니다.');
          if (result.status === 'sent') {
            await this.state(j, 'published', { remoteId: result.id, url: result.externalLink || undefined });
            return;
          }
          await this.state(j, 'processing', { remoteId: result.id });
          return;
        }
        if (!j.remoteId) throw new StoreError(400, 'Buffer 게시물 ID를 확인할 수 없습니다.');
        if (Date.now() - new Date(j.createdAt).getTime() > 30 * 60000)
          throw new StoreError(
            400,
            'Buffer 게시 처리가 30분 안에 끝나지 않았습니다. Buffer에서 상태를 확인해 주세요.',
          );
        const result = await bufferPost(apiKey, j.remoteId);
        if (result.status === 'error') throw new StoreError(400, 'Buffer가 게시물을 발행하지 못했습니다.');
        if (result.status === 'sent')
          await this.state(j, 'published', { remoteId: result.id, url: result.externalLink || undefined });
        return;
      }
      const token = await new MarketingStore(this.db).connectionToken(
        j.workspaceId,
        j.projectId,
        p.channel,
        j.connectionRevision,
        p.language,
      );
      const auth = `Bearer ${token}`,
        base =
          p.channel === 'threads' ? 'https://graph.threads.net/v1.0' : 'https://graph.instagram.com/v25.0';
      if (j.status === 'queued') {
        const identity = await socialIdentity(p.channel, token);
        if (identity.id !== p.userId) throw new StoreError(400, '게시할 계정이 일치하지 않습니다.');
        if (p.channel === 'x') {
          let mediaId: string | undefined;
          if (p.assetId) {
            const [asset] = await this.db.query(
              'SELECT content FROM marketing_assets WHERE id=$1 AND "workspaceId"=$2',
              [p.assetId, j.workspaceId],
            );
            const upload = await providerJson<any>('https://api.x.com/2/media/upload', auth, 'POST', {
              media: asset.content.toString('base64'),
              media_category: 'tweet_image',
            });
            if (
              !/^\d+$/.test(upload.data?.id) ||
              (upload.data.processing_info && upload.data.processing_info.state !== 'succeeded')
            )
              throw new StoreError(400, 'X 미디어 처리를 확인하지 못했습니다.');
            mediaId = upload.data.id;
          }
          await this.state(j, 'submitting');
          const result = await providerJson<any>('https://api.x.com/2/tweets', auth, 'POST', {
            text: p.caption,
            ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
          });
          if (!/^\d+$/.test(result.data?.id)) throw new ProviderError(true);
          await this.state(j, 'published', {
            remoteId: result.data.id,
            url: `https://x.com/i/web/status/${result.data.id}`,
          });
          return;
        }
        const media = p.assetId ? signedAssetUrl(j.workspaceId, p.assetId) : '';
        const body =
          p.channel === 'threads'
            ? {
                media_type: p.format === 'text' ? 'TEXT' : 'IMAGE',
                text: p.caption,
                ...(p.format === 'text' ? { auto_publish_text: false } : { image_url: media }),
              }
            : {
                caption: p.caption,
                ...(p.format === 'video'
                  ? {
                      media_type: 'REELS',
                      video_url: media,
                      share_to_feed: true,
                    }
                  : { image_url: media }),
              };
        const result = await providerJson<any>(
          `${base}/${p.userId}/${p.channel === 'threads' ? 'threads' : 'media'}`,
          auth,
          'POST',
          body,
          true,
        );
        if (!/^\d+$/.test(result.id)) throw new ProviderError(true);
        await this.state(j, 'processing', { containerId: result.id });
        return;
      }
      if (Date.now() - new Date(j.createdAt).getTime() > 30 * 60000)
        throw new StoreError(400, 'SNS 미디어 처리 시간이 초과되었습니다. 공급자에서 확인해 주세요.');
      const status = await providerJson<any>(
          `${base}/${j.containerId}?fields=${p.channel === 'threads' ? 'status' : 'status_code'}`,
          auth,
        ),
        code = status.status || status.status_code;
      if (['ERROR', 'EXPIRED'].includes(code))
        throw new StoreError(400, 'SNS가 미디어를 처리하지 못했습니다.');
      if (code !== 'FINISHED') return;
      // Compare-and-swap: only one polling worker may perform the irreversible publish call.
      const [claim] = await this.db.query(
        `WITH claimed AS (UPDATE publication_jobs SET status='submitting',"updatedAt"=now() WHERE id=$1 AND status='processing' RETURNING id) SELECT * FROM claimed`,
        [j.id],
      );
      if (!claim) return;
      await this.db.query(`UPDATE posts SET "publishStatus"='submitting' WHERE id=$1`, [j.postId]);
      const result = await providerJson<any>(
        `${base}/${p.userId}/${p.channel === 'threads' ? 'threads_publish' : 'media_publish'}`,
        auth,
        'POST',
        { creation_id: j.containerId },
        true,
      );
      if (!/^\d+$/.test(result.id)) throw new ProviderError(true);
      // Persist success before the optional permalink lookup, which must never cause a duplicate post.
      await this.state(j, 'published', { remoteId: result.id });
      try {
        const link = await providerJson<any>(`${base}/${result.id}?fields=permalink`, auth);
        const url = new URL(link.permalink);
        if (
          url.protocol === 'https:' &&
          [
            'www.instagram.com',
            'instagram.com',
            'www.threads.net',
            'threads.net',
            'www.threads.com',
            'threads.com',
          ].includes(url.hostname)
        )
          await this.state(j, 'published', {
            remoteId: result.id,
            url: url.toString(),
          });
      } catch {}
    } catch (e) {
      if (j.status === 'processing' && e instanceof ProviderError && !e.uncertain) return;
      await this.state(j, e instanceof ProviderError && e.uncertain ? 'uncertain' : 'failed', {
        error:
          e instanceof StoreError ? e.message : '게시 처리를 확인하지 못했습니다. 자동 재시도하지 않습니다.',
      });
    }
  }
}
