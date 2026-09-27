import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import { MarketingStore } from "./marketing-store";
import { downloadMedia } from "./marketing-security";
import {
  planContent,
  renderMedia,
  mediaStatus,
  ProviderError,
} from "./marketing-providers";
import { StoreError } from "./store";
import { contentHistory, chooseFreshContent } from "./marketing-history";
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
      await m.query(
        `UPDATE generation_jobs SET status=$2,"updatedAt"=now() WHERE id=$1`,
        [row.id, row.status === "queued" ? "planning" : "rendering"],
      );
      return row;
    });
    if (!j) return;
    try {
      const settings = await this.store.settingsRow(j.workspaceId);
      if (settings.revision !== j.settingsRevision)
        throw new StoreError(409, "API 설정이 변경되어 생성이 중단되었습니다.");
      const credentials = this.store.credentials(settings);
      if (j.status === "queued") {
        const useHistory = j.snapshot.plannerVersion === 2;
        const history = useHistory ? await contentHistory(this.db.manager, j.workspaceId, j.projectId, j.id) : undefined;
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
        // Serialize candidate selection with other workers and post creation/edits.
        // Reserve the chosen idea BEFORE any paid media request, closing the read/plan race.
        const result = await this.db.transaction(async m => {
          await this.store.store.project(j.workspaceId, j.snapshot.project.slug, m, true);
          const [current] = await m.query('SELECT status FROM generation_jobs WHERE id=$1 FOR UPDATE', [j.id]);
          if (current?.status !== "planning") return null;
          // Local comparison includes all 60 fetched records even if prompt memory was trimmed.
          const latest = useHistory ? await contentHistory(m, j.workspaceId, j.projectId, j.id, Infinity) : [];
          const candidate = useHistory ? chooseFreshContent(planned.candidates, latest) : planned.candidates[0];
          const selected = { ...candidate, usage: planned.usage, historyIds: latest.map(item => item.id) };
          await m.query('UPDATE generation_jobs SET result=$2,reference=NULL,"updatedAt"=now() WHERE id=$1', [j.id, JSON.stringify(selected)]);
          return selected;
        });
        if (!result) return;
        j.result = result;
        if (j.format === "text") {
          await this.complete(j);
          return;
        }
        const [claimed] = await this.db.query(
          `WITH claimed AS (UPDATE generation_jobs SET status='submitting',result=$2,reference=NULL,"updatedAt"=now() WHERE id=$1 AND status='planning' RETURNING id) SELECT * FROM claimed`,
          [j.id, JSON.stringify(result)],
        );
        if (!claimed) return;
        const submitted = await renderMedia(
          credentials,
          j.format,
          result.mediaPrompt,
        );
        if (
          typeof submitted.request_id !== "string" ||
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
            "미디어 생성 대기 시간이 2시간을 넘었습니다. 공급자 요청 이력을 확인해 주세요.",
          );
        const result = await mediaStatus(credentials, j.providerId),
          status = String(result.status).toLowerCase();
        if (["failed", "nsfw", "cancelled", "canceled"].includes(status))
          throw new StoreError(
            400,
            "미디어 생성이 실패 또는 차단되었습니다. 공급자 요청 이력을 확인해 주세요.",
          );
        if (!["completed", "succeeded"].includes(status)) return;
        const url =
          j.format === "image" ? result.images?.[0]?.url : result.video?.url;
        if (typeof url !== "string")
          throw new StoreError(
            502,
            "공급자 미디어 응답에 파일 주소가 없습니다.",
          );
        const asset = await downloadMedia(url);
        if (
          (j.format === "image" && !asset.mime.startsWith("image/")) ||
          (j.format === "video" && asset.mime !== "video/mp4")
        )
          throw new StoreError(400, "생성된 미디어 형식이 요청과 다릅니다.");
        await this.complete(j, asset);
      }
    } catch (e) {
      // Read-only polling may be retried; all paid submissions fail closed.
      if (j.status === "rendering" && e instanceof ProviderError) return;
      await this.db.query(
        `UPDATE generation_jobs SET status=$2,error=$3,reference=NULL,"updatedAt"=now() WHERE id=$1 AND status IN ('planning','submitting','rendering')`,
        [
          j.id,
          e instanceof ProviderError && e.uncertain ? "uncertain" : "failed",
          e instanceof StoreError
            ? e.message
            : "생성 작업을 완료하지 못했습니다. 자동 재시도하지 않습니다.",
        ],
      );
    }
  }
  private async complete(j: any, asset?: { mime: string; content: Buffer }) {
    await this.db.transaction(async (m) => {
      // Serialize profile edits and finalization. Keep the ORIGINAL profile revision.
      await this.store.store.project(
        j.workspaceId,
        j.snapshot.project.slug,
        m,
        true,
      );
      const [current] = await m.query(
        "SELECT status FROM generation_jobs WHERE id=$1 FOR UPDATE",
        [j.id],
      );
      if (!["planning", "rendering"].includes(current?.status)) return;
      const assetId = asset ? randomUUID() : null,
        id = randomUUID();
      if (asset)
        await m.query(
          'INSERT INTO marketing_assets (id,"workspaceId","projectId","jobId",mime,content) VALUES ($1,$2,$3,$4,$5,$6)',
          [
            assetId,
            j.workspaceId,
            j.projectId,
            j.id,
            asset.mime,
            asset.content,
          ],
        );
      await m.query(
        `INSERT INTO posts (id,"workspaceId","projectId",title,caption,brief,channel,language,"profileRevision",status,format,"assetId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'review',$10,$11)`,
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
          assetId,
        ],
      );
      await m.query(
        `UPDATE generation_jobs SET status='completed',"postId"=$2,result=$3,reference=NULL,"updatedAt"=now() WHERE id=$1`,
        [j.id, id, JSON.stringify(j.result)],
      );
      await this.store.event(
        m,
        j.workspaceId,
        j.projectId,
        j.actorId,
        "자동 생성 완료 · 게시 전 검토 필요",
      );
    });
  }
}
