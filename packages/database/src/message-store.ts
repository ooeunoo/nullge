import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { ContentMessage, MessageStatus, PostMetrics } from '@nullge/contracts';
import { Store, StoreError } from './store';

/** Message experiments: which message each post tests, and how the published posts did. */
export class MessageStore {
  private store: Store;
  constructor(readonly db: DataSource) {
    this.store = new Store(db);
  }
  async list(w: string, slug: string): Promise<ContentMessage[]> {
    const p = await this.store.project(w, slug);
    const rows = await this.db.query(
      `SELECT m.id,m.label,m.description,m.status,
        count(p.id)::int posts,
        count(p.id) FILTER (WHERE p."publishStatus"='published')::int published,
        count(x."postId")::int measured,
        coalesce(sum(x.reach),0)::int reach, coalesce(sum(x.saves),0)::int saves, coalesce(sum(x.shares),0)::int shares,
        coalesce(sum(x."profileVisits"),0)::int "profileVisits", coalesce(sum(x."linkClicks"),0)::int "linkClicks"
       FROM content_messages m
       LEFT JOIN posts p ON p."messageId"=m.id
       LEFT JOIN post_metrics x ON x."postId"=p.id
       WHERE m."workspaceId"=$1 AND m."projectId"=$2
       GROUP BY m.id ORDER BY m."createdAt", m.label`,
      [w, p.id],
    );
    return JSON.parse(JSON.stringify(rows));
  }
  async create(w: string, slug: string, actor: string, input: { label: string; description: string }) {
    const p = await this.store.project(w, slug);
    const [{ n }] = await this.db.query(
      'SELECT count(*)::int n FROM content_messages WHERE "workspaceId"=$1 AND "projectId"=$2',
      [w, p.id],
    );
    if (n >= 12) throw new StoreError(400, '메시지는 제품마다 12개까지 만들 수 있어요.');
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO content_messages (id,"workspaceId","projectId",label,description) VALUES ($1,$2,$3,$4,$5)',
      [id, w, p.id, input.label, input.description],
    );
    await this.event(w, p.id, actor, 'message_created', input.label);
    return (await this.list(w, slug)).find((m) => m.id === id)!;
  }
  async update(
    w: string,
    slug: string,
    id: string,
    actor: string,
    input: { label?: string; description?: string; status?: MessageStatus },
  ) {
    const p = await this.store.project(w, slug);
    const [row] = await this.db.query(
      `WITH changed AS (UPDATE content_messages SET label=coalesce($4,label),description=coalesce($5,description),status=coalesce($6,status)
       WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3 RETURNING *) SELECT * FROM changed`,
      [id, w, p.id, input.label ?? null, input.description ?? null, input.status ?? null],
    );
    if (!row) throw new StoreError(404, '메시지를 찾을 수 없어요.');
    await this.event(w, p.id, actor, input.status ? `message_${input.status}` : 'message_updated', row.label);
    return (await this.list(w, slug)).find((m) => m.id === id)!;
  }
  /** Tagging is planning metadata: it does not touch the post revision or its approval. */
  async tag(w: string, slug: string, postId: string, actor: string, messageId: string | null) {
    const p = await this.store.project(w, slug);
    if (messageId) {
      const [m] = await this.db.query(
        'SELECT id FROM content_messages WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3',
        [messageId, w, p.id],
      );
      if (!m) throw new StoreError(400, '이 제품의 메시지가 아니에요.');
    }
    const [post] = await this.db.query(
      `WITH changed AS (UPDATE posts SET "messageId"=$4 WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3 RETURNING id,title) SELECT * FROM changed`,
      [postId, w, p.id, messageId],
    );
    if (!post) throw new StoreError(404, '콘텐츠를 찾을 수 없어요.');
    await this.event(w, p.id, actor, 'post_message_tagged', post.title, postId);
    return { ok: true };
  }
  /** Results are recorded for published posts only, read from the platform's insights. */
  async recordMetrics(w: string, slug: string, postId: string, actor: string, input: PostMetrics) {
    const p = await this.store.project(w, slug);
    const [post] = await this.db.query(
      'SELECT id,title,"publishStatus" FROM posts WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3',
      [postId, w, p.id],
    );
    if (!post) throw new StoreError(404, '콘텐츠를 찾을 수 없어요.');
    if (post.publishStatus !== 'published')
      throw new StoreError(400, '게시된 콘텐츠만 결과를 기록할 수 있어요.');
    if (input.saves + input.shares > Math.max(input.reach, 1) * 5)
      throw new StoreError(400, '도달보다 반응이 너무 많아요. 숫자를 다시 확인해 주세요.');
    await this.db.query(
      `INSERT INTO post_metrics ("postId",reach,saves,shares,likes,comments,"profileVisits","linkClicks","recordedBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("postId") DO UPDATE SET reach=$2,saves=$3,shares=$4,likes=$5,comments=$6,"profileVisits"=$7,"linkClicks"=$8,"recordedAt"=now(),"recordedBy"=$9`,
      [
        postId,
        input.reach,
        input.saves,
        input.shares,
        input.likes ?? 0,
        input.comments ?? 0,
        input.profileVisits ?? 0,
        input.linkClicks ?? 0,
        actor,
      ],
    );
    await this.event(w, p.id, actor, 'post_metrics_recorded', post.title, postId);
    return { ok: true };
  }
  private event(w: string, projectId: string, actor: string, action: string, title: string, postId?: string) {
    return this.db.query(
      'INSERT INTO events (id,"workspaceId","projectId","actorId",action,title,"postId") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), w, projectId, actor, action, title, postId ?? null],
    );
  }
}
