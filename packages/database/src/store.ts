import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  contentGuide,
  emptyGuide,
  type Project,
  type Post,
  type PostInput,
  type ProfileInput,
  type Activity,
} from '@nullge/contracts';
import { uploadedImage, uploadedMedia, type UploadedMedia } from './uploaded-image';

export class StoreError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function normalized<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
/** Rows may hold an empty or older guide; readers always get a complete, valid one. */
export function guideOf(value: unknown) {
  const parsed = contentGuide.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyGuide();
}
function asProject(row: Record<string, unknown>): Project {
  return { ...normalized<Project>(row), guide: guideOf(row.guide) };
}
async function mediaContent(image?: string): Promise<UploadedMedia | undefined> {
  if (image === undefined) return undefined;
  try {
    return await uploadedMedia(image);
  } catch (error) {
    throw new StoreError(400, (error as Error).message);
  }
}
async function posterContent(
  media: UploadedMedia | undefined,
  poster?: string,
): Promise<UploadedMedia | undefined> {
  if (!poster || (media && media.format !== 'video')) return undefined; // no media: poster applies only if the post already holds a video
  try {
    return { content: await uploadedImage(poster), mime: 'image/jpeg', format: 'image' };
  } catch {
    return undefined;
  } // a broken poster never blocks the upload; the feed falls back to the video itself
}
export class Store {
  constructor(readonly db: DataSource) {}
  async project(
    workspaceId: string,
    slug: string,
    manager = this.db.manager,
    lock = false,
  ): Promise<Project> {
    const [project] = await manager.query(
      `SELECT * FROM projects WHERE "workspaceId"=$1 AND slug=$2${lock ? ' FOR UPDATE' : ''}`,
      [workspaceId, slug],
    );
    if (!project) throw new StoreError(404, '제품을 찾을 수 없습니다.');
    return asProject(project);
  }
  async dashboard(workspaceId: string) {
    const [projects, posts, activities] = await Promise.all([
      this.db.query('SELECT * FROM projects WHERE "workspaceId"=$1 ORDER BY name', [workspaceId]),
      this.db.query(
        `SELECT p.*, CASE WHEN x."postId" IS NULL THEN NULL ELSE to_jsonb(x) - 'postId' - 'recordedBy' END metrics, j."replyIds"
         FROM posts p LEFT JOIN post_metrics x ON x."postId"=p.id LEFT JOIN publication_jobs j ON j."postId"=p.id
         WHERE p."workspaceId"=$1 ORDER BY p."updatedAt" DESC LIMIT 200`,
        [workspaceId],
      ),
      this.db.query(
        'SELECT id, "projectId", action, title, "createdAt" FROM events WHERE "workspaceId"=$1 ORDER BY "createdAt" DESC LIMIT 30',
        [workspaceId],
      ),
    ]);
    return {
      ...normalized<{ posts: Post[]; activities: Activity[] }>({ posts, activities }),
      projects: projects.map(asProject),
    };
  }
  private async event(
    manager: EntityManager,
    workspaceId: string,
    projectId: string,
    actorId: string,
    action: string,
    title: string,
    postId: string | null = null,
  ) {
    await manager.query(
      'INSERT INTO events (id,"workspaceId","projectId","actorId",action,title,"postId") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), workspaceId, projectId, actorId, action, title, postId],
    );
  }
  async create(workspaceId: string, slug: string, actorId: string, input: PostInput): Promise<Post> {
    const media = await mediaContent(input.image),
      poster = await posterContent(media, input.poster);
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      const assetId = media ? await this.saveMedia(manager, workspaceId, project.id, media) : null;
      const posterAssetId =
        poster && media?.format === 'video'
          ? await this.saveMedia(manager, workspaceId, project.id, poster)
          : null;
      const [post] = await manager.query(
        `INSERT INTO posts (id,"workspaceId","projectId",title,caption,brief,channel,language,"profileRevision",format,"assetId","posterAssetId",replies) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          randomUUID(),
          workspaceId,
          project.id,
          input.title,
          input.caption,
          input.brief,
          input.channel,
          input.language,
          project.revision,
          media ? media.format : 'text',
          assetId,
          posterAssetId,
          JSON.stringify(input.replies ?? []),
        ],
      );
      await this.event(manager, workspaceId, project.id, actorId, 'post_created', post.title, post.id);
      return normalized(post);
    });
  }
  async update(
    workspaceId: string,
    slug: string,
    id: string,
    actorId: string,
    input: PostInput & { revision: number },
  ): Promise<Post> {
    const media = await mediaContent(input.image),
      poster = await posterContent(media, input.poster);
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      const assetId = media ? await this.saveMedia(manager, workspaceId, project.id, media) : null;
      const posterAssetId = poster ? await this.saveMedia(manager, workspaceId, project.id, poster) : null;
      const [post] = await manager.query(
        `WITH changed AS (UPDATE posts SET title=$5,caption=$6,brief=$7,channel=$8,language=$9,
        status='draft',"approvedAt"=NULL,"approvedBy"=NULL,"profileRevision"=$10,revision=revision+1,"updatedAt"=now(),
        "assetId"=COALESCE($11::uuid,"assetId"),format=CASE WHEN $11::uuid IS NULL THEN format ELSE $12::text END,
        "posterAssetId"=CASE WHEN $11::uuid IS NULL THEN (CASE WHEN format='video' THEN COALESCE($13::uuid,"posterAssetId") ELSE "posterAssetId" END) ELSE $13::uuid END,
        "sourceAssetId"=CASE WHEN $11::uuid IS NULL THEN "sourceAssetId" ELSE NULL END,
        replies=COALESCE($14::jsonb,replies)
        WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 AND revision=$4 AND "publishStatus" IS NULL RETURNING *) SELECT * FROM changed`,
        [
          workspaceId,
          project.id,
          id,
          input.revision,
          input.title,
          input.caption,
          input.brief,
          input.channel,
          input.language,
          project.revision,
          assetId,
          media ? media.format : null,
          posterAssetId,
          // Replies are post content: saving them bumps the revision and resets approval like the caption does.
          input.replies === undefined ? null : JSON.stringify(input.replies),
        ],
      );
      if (!post)
        throw new StoreError(
          409,
          '다른 화면에서 변경되었거나 이 제품의 콘텐츠가 아닙니다. 새로고침해 주세요.',
        );
      await this.event(manager, workspaceId, project.id, actorId, 'post_updated', post.title, post.id);
      return normalized(post);
    });
  }
  private async saveMedia(
    manager: EntityManager,
    workspaceId: string,
    projectId: string,
    media: UploadedMedia,
  ) {
    const id = randomUUID();
    await manager.query(
      `INSERT INTO marketing_assets (id,"workspaceId","projectId",mime,content) VALUES ($1,$2,$3,$4,$5)`,
      [id, workspaceId, projectId, media.mime, media.content],
    );
    return id;
  }
  async transition(
    workspaceId: string,
    slug: string,
    id: string,
    actorId: string,
    revision: number,
    action: 'approve' | 'reopen',
  ): Promise<Post> {
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      const [current] = await manager.query(
        'SELECT * FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 AND revision=$4 FOR UPDATE',
        [workspaceId, project.id, id, revision],
      );
      if (!current) throw new StoreError(409, '콘텐츠가 변경되었습니다. 새로고침해 주세요.');
      if (current.publishStatus)
        throw new StoreError(409, '게시 요청이 기록된 콘텐츠는 수정할 수 없습니다. 새 초안을 만들어 주세요.');
      if (action === 'approve' && current.status !== 'draft')
        throw new StoreError(409, '초안만 승인할 수 있습니다.');
      if (action === 'approve' && !current.caption.trim())
        throw new StoreError(400, '본문을 작성한 뒤 승인해 주세요.');
      if (
        action === 'approve' &&
        (!project.profileReviewedAt || current.profileRevision !== project.revision)
      )
        throw new StoreError(400, '최신 제품·브랜드 정보를 먼저 확인하고, 콘텐츠를 다시 저장해 주세요.');
      const status = action === 'approve' ? 'approved' : 'draft';
      const [post] = await manager.query(
        `WITH changed AS (UPDATE posts SET status=$2, revision=revision+1,"approvedAt"=$3,"approvedBy"=$4,"updatedAt"=now() WHERE id=$1 RETURNING *) SELECT * FROM changed`,
        [id, status, action === 'approve' ? new Date() : null, action === 'approve' ? actorId : null],
      );
      await this.event(manager, workspaceId, project.id, actorId, `post_${action}`, post.title, post.id);
      return normalized(post);
    });
  }
  /** Marks a post as published outside the console (the operator posted it by hand) so it is locked and linked like a Buffer publication. */
  async recordPublication(
    workspaceId: string,
    slug: string,
    id: string,
    actorId: string,
    revision: number,
    url: string,
  ): Promise<Post> {
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      const [current] = await manager.query(
        'SELECT * FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 AND revision=$4 FOR UPDATE',
        [workspaceId, project.id, id, revision],
      );
      if (!current) throw new StoreError(409, '콘텐츠가 변경되었습니다. 새로고침해 주세요.');
      if (current.publishStatus && current.publishStatus !== 'failed')
        throw new StoreError(409, '이미 게시 기록이 있는 콘텐츠입니다.');
      const [post] = await manager.query(
        `WITH changed AS (UPDATE posts SET status='approved',"approvedAt"=COALESCE("approvedAt",now()),"approvedBy"=COALESCE("approvedBy",$2),"publishStatus"='published',"publishedUrl"=$3,"publishError"=NULL,revision=revision+1,"updatedAt"=now() WHERE id=$1 RETURNING *) SELECT * FROM changed`,
        [id, actorId, url],
      );
      await this.event(
        manager,
        workspaceId,
        project.id,
        actorId,
        'post_published_externally',
        post.title,
        post.id,
      );
      return normalized(post);
    });
  }
  /** Removes a post that has never reached a channel: no publication, or one Buffer rejected. Events keep the title, generation jobs keep their record. */
  async remove(
    workspaceId: string,
    slug: string,
    id: string,
    actorId: string,
    revision: number,
  ): Promise<{ id: string }> {
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      const [current] = await manager.query(
        'SELECT * FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND id=$3 FOR UPDATE',
        [workspaceId, project.id, id],
      );
      if (!current || current.revision !== revision)
        throw new StoreError(409, '콘텐츠가 변경되었거나 이미 삭제되었습니다. 새로고침해 주세요.');
      if (current.publishStatus && current.publishStatus !== 'failed')
        throw new StoreError(409, '게시 요청이 기록된 콘텐츠는 삭제할 수 없습니다.');
      await manager.query('DELETE FROM publication_jobs WHERE "postId"=$1', [id]);
      await manager.query('UPDATE events SET "postId"=NULL WHERE "postId"=$1', [id]);
      await manager.query('UPDATE generation_jobs SET "postId"=NULL WHERE "postId"=$1', [id]);
      await manager.query('DELETE FROM posts WHERE id=$1', [id]);
      for (const asset of [current.assetId, current.posterAssetId, current.sourceAssetId])
        if (asset) {
          await manager.query(
            `DELETE FROM marketing_assets WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3 AND NOT EXISTS (SELECT 1 FROM posts WHERE "assetId"=$1 OR "posterAssetId"=$1 OR "sourceAssetId"=$1)`,
            [asset, workspaceId, project.id],
          );
        }
      await this.event(manager, workspaceId, project.id, actorId, 'post_deleted', current.title);
      return { id };
    });
  }
  async updateProfile(
    workspaceId: string,
    slug: string,
    actorId: string,
    input: ProfileInput,
  ): Promise<Project> {
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      if (project.revision !== input.revision)
        throw new StoreError(409, '제품 정보가 변경되었습니다. 새로고침해 주세요.');
      const [active] = await manager.query(
        `SELECT count(*)::int n FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 AND "publishStatus" IN ('queued','creating','processing','submitting')`,
        [workspaceId, project.id],
      );
      if (active.n) throw new StoreError(409, '게시 작업이 완료된 뒤 제품 정보를 변경해 주세요.');
      const guide = input.guide ?? project.guide;
      const logo = guide.visual.logoAssetId;
      if (logo) {
        const [asset] = await manager.query(
          `SELECT 1 FROM marketing_assets WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3 AND mime IN ('image/png','image/jpeg')`,
          [logo, workspaceId, project.id],
        );
        if (!asset) throw new StoreError(400, '로고 이미지를 다시 올려 주세요.');
      }
      const [next] = await manager.query(
        `WITH changed AS (UPDATE projects SET description=$2,audience=$3,facts=$4,tone=$5,avoid=$6,website=$7,guide=$8,revision=revision+1,"profileReviewedAt"=NULL WHERE id=$1 RETURNING *) SELECT * FROM changed`,
        [
          project.id,
          input.description,
          input.audience,
          input.facts,
          input.tone,
          input.avoid,
          input.website,
          JSON.stringify(guide),
        ],
      );
      await manager.query(
        'INSERT INTO profile_versions ("workspaceId","projectId",revision,snapshot) VALUES ($1,$2,$3,$4)',
        [workspaceId, project.id, next.revision, JSON.stringify(next)],
      );
      await manager.query(
        `UPDATE posts SET status='draft',revision=revision+1,"approvedAt"=NULL,"approvedBy"=NULL,"updatedAt"=now() WHERE "workspaceId"=$1 AND "projectId"=$2 AND status='approved' AND "publishStatus" IS NULL`,
        [workspaceId, project.id],
      );
      await this.event(manager, workspaceId, project.id, actorId, 'profile_updated', project.name);
      return asProject(next);
    });
  }
  async reviewProfile(
    workspaceId: string,
    slug: string,
    actorId: string,
    revision: number,
  ): Promise<Project> {
    return this.db.transaction(async (manager) => {
      const project = await this.project(workspaceId, slug, manager, true);
      if (project.revision !== revision)
        throw new StoreError(409, '제품 정보가 변경되었습니다. 새로고침해 주세요.');
      if (!project.description.trim() || !project.facts.trim())
        throw new StoreError(400, '제품 설명과 확인된 기능을 작성해 주세요.');
      const [next] = await manager.query(
        'WITH changed AS (UPDATE projects SET "profileReviewedAt"=now() WHERE id=$1 RETURNING *) SELECT * FROM changed',
        [project.id],
      );
      await this.event(manager, workspaceId, project.id, actorId, 'profile_reviewed', project.name);
      return asProject(next);
    });
  }
}
