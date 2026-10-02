import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { MarketingStore } from './marketing-store';
import { downloadMedia } from './marketing-security';
import {
  planContent,
  renderMedia,
  mediaStatus,
  ProviderError,
  reviewCandidates,
} from './marketing-providers';
import { StoreError, guideOf } from './store';
import { guideViolations, withFixedHashtags } from './content-checks';
import { renderTemplate } from './content-render';
import { contentHistory, chooseFreshContent, isRepeatedContent } from './marketing-history';
export class MarketingWorker {
  readonly store: MarketingStore;
  constructor(readonly db: DataSource) {
    this.store = new MarketingStore(db);
  }
  async tick() {
    // Stale non-idempotent submissions are never retried automatically.
    await this.db.query(
      `UPDATE generation_jobs SET status='uncertain',error='응답 확인이 중단되었습니다. 공급자 사용 이력을 확인해 주세요. 자동 재시도하지 않습니다.',reference=NULL,"updatedAt"=now() WHERE status IN ('planning','submitting') AND "updatedAt"<now()-interval '5 minutes'`,
    );
    await this.db.query(
      `UPDATE generation_jobs SET reference=NULL WHERE status='quoted' AND "quoteExpiresAt"<now()`,
    );
    const j = await this.db.transaction(async (m) => {
      const [row] = await m.query(
        `SELECT * FROM generation_jobs WHERE status='queued' OR (status='rendering' AND "updatedAt"<now()-interval '12 seconds') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      if (!row) return null;
      await m.query(`UPDATE generation_jobs SET status=$2,"updatedAt"=now() WHERE id=$1`, [
        row.id,
        row.status === 'queued' ? 'planning' : 'rendering',
      ]);
      return row;
    });
    if (!j) return;
    try {
      const settings = await this.store.settingsRow(j.workspaceId);
      if (settings.revision !== j.settingsRevision)
        throw new StoreError(409, 'API 설정이 변경되어 생성이 중단되었습니다.');
      const credentials = this.store.credentials(settings);
      if (j.status === 'queued') {
        const useHistory = j.snapshot.plannerVersion >= 2;
        const useGuide = j.snapshot.plannerVersion >= 3;
        const guide = guideOf(j.snapshot.project.guide);
        const history = useHistory
          ? await contentHistory(this.db.manager, j.workspaceId, j.projectId, j.id)
          : undefined;
        const planned = await planContent(
          credentials,
          j.snapshot.model,
          j.snapshot.project,
          {
            prompt: j.prompt,
            format: j.format,
            channel: j.channel,
            language: j.language,
            reference: j.reference || undefined,
          },
          history,
        );
        let ranked = planned.candidates;
        const reviewOf = new Map<object, { score: number; reason: string }>();
        if (useGuide) {
          const checked = planned.candidates
            .map((c) => ({ ...c, caption: withFixedHashtags(c.caption, j.channel, guide) }))
            .map((c) => ({ c, issues: guideViolations(c, j.channel, guide, j.snapshot.project.website) }));
          const passing = checked.filter((x) => !x.issues.length).map((x) => x.c);
          if (!passing.length)
            throw new StoreError(
              400,
              `가이드 검사를 통과한 후보가 없습니다 (${[...new Set(checked.flatMap((x) => x.issues))].join(', ')}). 이미지·영상은 생성하지 않았어요. 가이드나 방향을 조정해 다시 요청해 주세요.`,
            );
          // Drop ideas that repeat history before paying for review; the locked pick below re-checks.
          const fresh = passing.filter((c) => !(history || []).some((h) => isRepeatedContent(c, h)));
          if (!fresh.length) chooseFreshContent(passing, history || []);
          const review = await reviewCandidates(
            credentials,
            j.snapshot.model,
            j.snapshot.project,
            { channel: j.channel, language: j.language, format: j.format },
            fresh,
          );
          const accepted = review.filter((r) => !r.reject);
          if (!accepted.length)
            throw new StoreError(
              400,
              `검수에서 모든 후보가 탈락했습니다 (${review
                .map((r) => r.reason)
                .filter(Boolean)
                .slice(0, 2)
                .join(' / ')}). 이미지·영상은 생성하지 않았어요.`,
            );
          ranked = accepted.map((r) => {
            reviewOf.set(fresh[r.index], { score: r.score, reason: r.reason });
            return fresh[r.index];
          });
        }
        // Serialize candidate selection with other workers and post creation/edits.
        // Reserve the chosen idea BEFORE any paid media request, closing the read/plan race.
        const result = await this.db.transaction(async (m) => {
          await this.store.store.project(j.workspaceId, j.snapshot.project.slug, m, true);
          const [current] = await m.query('SELECT status FROM generation_jobs WHERE id=$1 FOR UPDATE', [
            j.id,
          ]);
          if (current?.status !== 'planning') return null;
          // Local comparison includes all 60 fetched records even if prompt memory was trimmed.
          const latest = useHistory
            ? await contentHistory(m, j.workspaceId, j.projectId, j.id, Infinity)
            : [];
          const candidate = useHistory ? chooseFreshContent(ranked, latest) : ranked[0];
          const selected = {
            ...candidate,
            usage: planned.usage,
            historyIds: latest.map((item) => item.id),
            ...(useGuide ? { review: reviewOf.get(candidate) ?? null } : {}),
          };
          await m.query('UPDATE generation_jobs SET result=$2,reference=NULL,"updatedAt"=now() WHERE id=$1', [
            j.id,
            JSON.stringify(selected),
          ]);
          return selected;
        });
        if (!result) return;
        j.result = result;
        if (j.format === 'text') {
          await this.complete(j);
          return;
        }
        const [claimed] = await this.db.query(
          `WITH claimed AS (UPDATE generation_jobs SET status='submitting',result=$2,reference=NULL,"updatedAt"=now() WHERE id=$1 AND status='planning' RETURNING id) SELECT * FROM claimed`,
          [j.id, JSON.stringify(result)],
        );
        if (!claimed) return;
        const style = guideOf(j.snapshot.project.guide).visual.photoStyle;
        const prompt =
          useGuide && style ? `${result.mediaPrompt}\n${style}`.slice(0, 2200) : result.mediaPrompt;
        const submitted = await renderMedia(credentials, j.format, prompt);
        if (
          typeof submitted.request_id !== 'string' ||
          !submitted.request_id ||
          submitted.request_id.length > 200
        )
          throw new ProviderError(true);
        await this.db.query(
          `UPDATE generation_jobs SET status='rendering',"providerId"=$2,"updatedAt"=now() WHERE id=$1 AND status='submitting'`,
          [j.id, submitted.request_id],
        );
      } else {
        if (Date.now() - new Date(j.createdAt).getTime() > 2 * 3600000)
          throw new StoreError(
            400,
            '미디어 생성 대기 시간이 2시간을 넘었습니다. 공급자 요청 이력을 확인해 주세요.',
          );
        const result = await mediaStatus(credentials, j.providerId),
          status = String(result.status).toLowerCase();
        if (['failed', 'nsfw', 'cancelled', 'canceled'].includes(status))
          throw new StoreError(
            400,
            '미디어 생성이 실패 또는 차단되었습니다. 공급자 요청 이력을 확인해 주세요.',
          );
        if (!['completed', 'succeeded'].includes(status)) return;
        const url = j.format === 'image' ? result.images?.[0]?.url : result.video?.url;
        if (typeof url !== 'string') throw new StoreError(502, '공급자 미디어 응답에 파일 주소가 없습니다.');
        const asset = await downloadMedia(url);
        if (
          (j.format === 'image' && !asset.mime.startsWith('image/')) ||
          (j.format === 'video' && asset.mime !== 'video/mp4')
        )
          throw new StoreError(400, '생성된 미디어 형식이 요청과 다릅니다.');
        await this.complete(j, asset);
      }
    } catch (e) {
      // Read-only polling may be retried; all paid submissions fail closed.
      if (j.status === 'rendering' && e instanceof ProviderError) return;
      await this.db.query(
        `UPDATE generation_jobs SET status=$2,error=$3,reference=NULL,"updatedAt"=now() WHERE id=$1 AND status IN ('planning','submitting','rendering')`,
        [
          j.id,
          e instanceof ProviderError && e.uncertain ? 'uncertain' : 'failed',
          e instanceof StoreError ? e.message : '생성 작업을 완료하지 못했습니다. 자동 재시도하지 않습니다.',
        ],
      );
    }
  }
  /** Composes the generated photo into the product's poster template, if the guide asks for one. */
  private async composed(j: any, asset?: { mime: string; content: Buffer }) {
    const guide = guideOf(j.snapshot.project.guide);
    const headline: string[] = Array.isArray(j.result?.headline) ? j.result.headline : [];
    if (j.format !== 'image' || !asset || guide.visual.template !== 'photo-headline' || !headline.length)
      return null;
    let logo: Buffer | undefined;
    if (guide.visual.logoAssetId) {
      const [row] = await this.db.query(
        'SELECT content FROM marketing_assets WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3',
        [guide.visual.logoAssetId, j.workspaceId, j.projectId],
      );
      logo = row?.content;
    }
    return renderTemplate({
      kind: 'photo-headline',
      palette: guide.visual.palette,
      tagline: guide.visual.tagline,
      headline,
      subline: j.result.subline || '',
      photo: asset.content,
      logo,
    });
  }
  private async complete(j: any, asset?: { mime: string; content: Buffer }) {
    const poster = await this.composed(j, asset);
    await this.db.transaction(async (m) => {
      // Serialize profile edits and finalization. Keep the ORIGINAL profile revision.
      await this.store.store.project(j.workspaceId, j.snapshot.project.slug, m, true);
      const [current] = await m.query('SELECT status FROM generation_jobs WHERE id=$1 FOR UPDATE', [j.id]);
      if (!['planning', 'rendering'].includes(current?.status)) return;
      const assetId = asset ? randomUUID() : null,
        id = randomUUID();
      if (asset)
        await m.query(
          'INSERT INTO marketing_assets (id,"workspaceId","projectId","jobId",mime,content) VALUES ($1,$2,$3,$4,$5,$6)',
          [assetId, j.workspaceId, j.projectId, j.id, asset.mime, asset.content],
        );
      // The raw photo stays on the job; the post shows the composed poster.
      const postAssetId = poster ? randomUUID() : assetId;
      if (poster)
        await m.query(
          'INSERT INTO marketing_assets (id,"workspaceId","projectId",mime,content) VALUES ($1,$2,$3,$4,$5)',
          [postAssetId, j.workspaceId, j.projectId, 'image/jpeg', poster],
        );
      await m.query(
        `INSERT INTO posts (id,"workspaceId","projectId",title,caption,brief,channel,language,"profileRevision",status,format,"assetId","sourceAssetId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12)`,
        [
          id,
          j.workspaceId,
          j.projectId,
          j.result.title,
          j.result.caption,
          j.prompt,
          j.channel,
          j.language,
          j.profileRevision,
          j.format,
          postAssetId,
          poster ? assetId : null,
        ],
      );
      await m.query(
        `UPDATE generation_jobs SET status='completed',"postId"=$2,result=$3,reference=NULL,"updatedAt"=now() WHERE id=$1`,
        [j.id, id, JSON.stringify(j.result)],
      );
      await this.store.event(m, j.workspaceId, j.projectId, j.actorId, '자동 생성 완료 · 게시 전 검토 필요');
    });
  }
}
