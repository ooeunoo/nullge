import { isScheduled, type Connection, type Post } from '@nullge/contracts';
import { api } from './api';

const KST = 9 * 3600_000;
/** "YYYY-MM-DDTHH:mm" in Seoul time, for a datetime-local input. */
export const toKstInput = (iso: string | number | Date) =>
  new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 16);
export const fromKstInput = (value: string) => new Date(`${value}:00+09:00`).toISOString();

/** Next Monday, Wednesday or Friday at 19:00 KST that this product and channel have not used yet. */
export function suggestSlot(
  post: Pick<Post, 'projectId' | 'channel'>,
  posts: Post[],
  now = Date.now(),
  reserved: string[] = [],
) {
  const taken = new Set([
    ...posts
      .filter((p) => p.projectId === post.projectId && p.channel === post.channel && isScheduled(p))
      .map((p) => toKstInput(p.scheduledAt!).slice(0, 10)),
    ...reserved.map((r) => r.slice(0, 10)),
  ]);
  for (let day = 0; day < 21; day++) {
    const slot = new Date(fromKstInput(`${toKstInput(now + day * 86400_000).slice(0, 10)}T19:00`));
    const weekday = new Date(slot.getTime() + KST).getUTCDay();
    if (![1, 3, 5].includes(weekday) || slot.getTime() < now + 30 * 60_000) continue;
    if (!taken.has(toKstInput(slot).slice(0, 10))) return toKstInput(slot);
  }
  return toKstInput(now + 86400_000);
}

/** Approves a draft if needed and schedules it on the account of its channel and language. */
export async function approveAndSchedule(slug: string, post: Post, kstValue: string) {
  let current = post;
  if (current.status === 'draft')
    current = await api<Post>(`projects/${slug}/posts/${post.id}/approve`, { revision: post.revision });
  const connections = await api<Connection[]>(`projects/${slug}/channels`);
  const account = connections.find(
    (c) => c.channel === current.channel && c.language === current.language && c.connected,
  );
  if (!account)
    throw new Error('이 언어의 채널 계정이 연결되지 않았어요. 제품 설정 → 채널에서 먼저 연결해 주세요.');
  return api<Post>(`projects/${slug}/posts/${post.id}/schedule`, {
    revision: current.revision,
    connectionRevision: account.revision,
    scheduledAt: fromKstInput(kstValue),
  });
}

/** Suggestions for a list of drafts, each product getting its own Monday/Wednesday/Friday instead of one day for all. */
export function suggestSlots(drafts: Post[], posts: Post[], now = Date.now()) {
  const used: Record<string, string[]> = {};
  return Object.fromEntries(
    drafts.map((d) => {
      const key = d.projectId;
      const slot = suggestSlot(d, posts, now, used[key] || []);
      (used[key] ||= []).push(slot);
      return [d.id, slot];
    }),
  );
}
