import type { Channel, ContentGuide } from '@nullge/contracts';

/**
 * Deterministic checks that every generated candidate must pass. Product-specific rules come only from the
 * guide; the shared list holds rules that apply to all products.
 */
export const CHANNEL_LIMITS: Record<Channel, number> = { x: 100, threads: 450, instagram: 1900 };
/** Operator decision 2026-09-27: captions and media never carry AI-generation disclosure text. */
const SHARED_BANNED = [
  /AI\s*(로|으로)\s*(제작|연출|생성)한/i,
  /AI[-\s]?generated\s+(image|video|content)/i,
  /AI 모델로 연출/i,
];

const fold = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
export const hashtagsOf = (text: string) => text.match(/#[\p{L}\p{N}_]+/gu) || [];

export interface CheckTarget {
  caption: string;
  title?: string;
  headline?: string[];
  subline?: string;
}

export function guideViolations(
  candidate: CheckTarget,
  channel: Channel,
  guide: ContentGuide,
  website: string,
): string[] {
  const issues: string[] = [];
  const all = [candidate.title, candidate.caption, ...(candidate.headline || []), candidate.subline]
    .filter(Boolean)
    .join('\n');
  if (Array.from(candidate.caption).length > CHANNEL_LIMITS[channel]) issues.push('채널 글자 수 초과');
  for (const rule of SHARED_BANNED) if (rule.test(all)) issues.push('AI 제작 고지 문구');
  const folded = fold(all);
  for (const phrase of guide.bannedPhrases)
    if (folded.includes(fold(phrase))) issues.push(`금지 문구: ${phrase}`);
  if (guide.requireWebsite && website) {
    const bare = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!candidate.caption.includes(bare)) issues.push('웹사이트 주소 누락');
  }
  if (hashtagsOf(candidate.caption).length > guide.hashtags.max) issues.push('해시태그 개수 초과');
  return issues;
}

/** Appends the guide's fixed hashtags that are missing, if the channel limit and tag budget allow. */
export function withFixedHashtags(caption: string, channel: Channel, guide: ContentGuide) {
  const present = new Set(hashtagsOf(caption).map((t) => t.toLowerCase()));
  const missing = guide.hashtags.fixed.filter((t) => !present.has(t.toLowerCase()));
  if (!missing.length || present.size + missing.length > guide.hashtags.max) return caption;
  const next = `${caption.trimEnd()}${/#[\p{L}\p{N}_]+\s*$/u.test(caption.trimEnd()) ? ' ' : '\n'}${missing.join(' ')}`;
  return Array.from(next).length <= CHANNEL_LIMITS[channel] ? next : caption;
}
