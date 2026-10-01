import type { EntityManager } from 'typeorm';
import { StoreError } from './store';

// Also reserved in the quote: new posts between quote and execution cannot inflate it.
export const HISTORY_BYTES = 48_000;
export const PLANNING_OUTPUT_TOKENS = 3600;
export interface ContentCandidate {
  title: string;
  caption: string;
  mediaPrompt: string;
  topic?: string;
  angle?: string;
  keyMessage?: string;
  visualConcept?: string;
}
export interface ContentHistory extends ContentCandidate {
  id: string;
  state: string;
  format: string;
}

/** Product-only memory, including claims from workers that have not created a post yet. */
export async function contentHistory(
  manager: EntityManager,
  workspaceId: string,
  projectId: string,
  excludeJob?: string,
  byteLimit = HISTORY_BYTES,
): Promise<ContentHistory[]> {
  const rows = await manager.query(
    `
    WITH published AS (
      SELECT p.*, 1 priority FROM posts p WHERE p."workspaceId"=$1 AND p."projectId"=$2
        AND p."publishStatus"='published' ORDER BY p."updatedAt" DESC, p.id LIMIT 20
    ), recent AS (
      SELECT p.*, 2 priority FROM posts p WHERE p."workspaceId"=$1 AND p."projectId"=$2
        AND p."publishStatus" IS DISTINCT FROM 'published' ORDER BY p."updatedAt" DESC, p.id LIMIT 20
    ), posts_memory AS (
      SELECT p.id, p.title, p.caption, p.format, coalesce(p."publishStatus",p.status) state,
        j.result, p.priority, p."updatedAt" FROM (SELECT * FROM published UNION ALL SELECT * FROM recent) p
      LEFT JOIN generation_jobs j ON j."postId"=p.id AND j."workspaceId"=$1 AND j."projectId"=$2
    ), pending AS (
      SELECT id, result->>'title' title, result->>'caption' caption, format, status state,
        result, 0 priority, "updatedAt" FROM generation_jobs
      WHERE "workspaceId"=$1 AND "projectId"=$2 AND ($3::uuid IS NULL OR id<>$3)
        AND "postId" IS NULL AND result IS NOT NULL
        AND status IN ('planning','submitting','rendering','uncertain')
      ORDER BY "updatedAt" DESC, id LIMIT 20
    ) SELECT * FROM (SELECT * FROM pending UNION ALL SELECT * FROM posts_memory) memory
      ORDER BY priority, "updatedAt" DESC, id`,
    [workspaceId, projectId, excludeJob || null],
  );
  const history: ContentHistory[] = [];
  for (const row of rows) {
    const result = row.result || {};
    const item: ContentHistory = {
      id: row.id,
      state: row.state,
      format: row.format,
      title: String(row.title || '').slice(0, 120),
      caption: String(row.caption || '').slice(0, 1900),
      mediaPrompt: '', // Compact visual descriptors replace long rendering instructions.
      ...Object.fromEntries(
        ['topic', 'angle', 'keyMessage', 'visualConcept'].map((key) => [
          key,
          typeof result[key] === 'string' ? result[key].slice(0, 160) : '',
        ]),
      ),
    };
    if (Buffer.byteLength(JSON.stringify([...history, item])) <= byteLimit) history.push(item);
  }
  return history;
}

function normalize(value = '') {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/AI로 제작한 이미지·영상입니다\.|AI-generated image\/video\./gi, '')
    .replace(/https?:\/\/\S+|#[\p{L}\p{N}_]+/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}
function similar(a = '', b = '', threshold = 0.78) {
  const x = normalize(a),
    y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 12) return false;
  const grams = (s: string) => new Set(Array.from({ length: s.length - 2 }, (_, i) => s.slice(i, i + 3)));
  const left = grams(x),
    right = grams(y);
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection++;
  return (2 * intersection) / (left.size + right.size) >= threshold;
}
export function isRepeatedContent(candidate: ContentCandidate, previous: ContentCandidate) {
  return (
    similar(candidate.caption, previous.caption) ||
    (similar(candidate.topic, previous.topic) && similar(candidate.angle, previous.angle)) ||
    similar(candidate.keyMessage, previous.keyMessage, 0.88) ||
    similar(candidate.visualConcept, previous.visualConcept, 0.9)
  );
}
export function chooseFreshContent(candidates: ContentCandidate[], history: ContentHistory[]) {
  const candidate = candidates.find((c) => !history.some((h) => isRepeatedContent(c, h)));
  if (!candidate)
    throw new StoreError(
      409,
      '기존 콘텐츠와 다른 소재를 찾지 못했습니다. 이미지·영상은 생성하지 않았어요. 다른 방향을 입력해 새로 요청해 주세요. 기획 비용은 발생했을 수 있습니다.',
    );
  return candidate;
}
