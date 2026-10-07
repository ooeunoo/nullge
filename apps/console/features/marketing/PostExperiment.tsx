'use client';
import { useEffect, useState } from 'react';
import {
  responseRate,
  type ContentMessage,
  type Post,
  type PostMetrics,
  type Project,
} from '@nullge/contracts';
import { call, message } from './shared';

const FIELDS: [keyof PostMetrics, string, string][] = [
  ['reach', '도달', '이 게시물을 본 계정 수'],
  ['saves', '저장', ''],
  ['shares', '공유', 'DM 공유 포함'],
  ['profileVisits', '프로필 방문', ''],
  ['linkClicks', '링크 클릭', ''],
];

/** Which message this post tests and, once published, its results from the platform's insights. */
export function PostExperiment({ project, post }: { project: Project; post: Post }) {
  const [messages, setMessages] = useState<ContentMessage[]>([]),
    [messageId, setMessageId] = useState(post.messageId ?? ''),
    [metrics, setMetrics] = useState<Record<string, string>>(
      Object.fromEntries(FIELDS.map(([k]) => [k, post.metrics ? String(post.metrics[k] ?? 0) : ''])),
    ),
    [state, setState] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    call<ContentMessage[]>(`projects/${project.slug}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [project.slug]);
  async function send(task: () => Promise<unknown>, done: string) {
    setBusy(true);
    setState('');
    try {
      await task();
      setState(done);
    } catch (e) {
      setState(message(e));
    } finally {
      setBusy(false);
    }
  }
  const published = post.publishStatus === 'published';
  const n = (k: string) => Number(metrics[k] || 0);
  const numbers: PostMetrics = {
    reach: n('reach'),
    saves: n('saves'),
    shares: n('shares'),
    likes: post.metrics?.likes ?? 0,
    comments: post.metrics?.comments ?? 0,
    profileVisits: n('profileVisits'),
    linkClicks: n('linkClicks'),
  };
  const rate = responseRate(numbers);
  return (
    <section className="panel post-experiment">
      <div className="section-title">
        <h3>메시지 실험</h3>
      </div>
      <label>
        이 콘텐츠가 시험하는 메시지
        <select
          value={messageId}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value;
            setMessageId(next);
            void send(
              () => call(`projects/${project.slug}/posts/${post.id}/message`, { messageId: next || null }),
              '메시지를 저장했어요. 승인 상태는 그대로예요.',
            );
          }}
        >
          <option value="">정하지 않음</option>
          {messages.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {messages.length === 0 && (
        <p className="field-hint">제품 화면의 "메시지 실험"에서 시험할 메시지를 먼저 만들어 주세요.</p>
      )}
      {published && (
        <form
          className="metrics-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              () => call(`projects/${project.slug}/posts/${post.id}/metrics`, numbers),
              '결과를 저장했어요.',
            );
          }}
        >
          <p className="field-hint">
            게시 2일 뒤 Instagram 인사이트(또는 Threads 활동)에서 숫자를 옮겨 적어요.
          </p>
          <div className="metrics-grid">
            {FIELDS.map(([key, label, hint]) => (
              <label key={key}>
                {label}
                {hint && <span className="field-hint">{hint}</span>}
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={metrics[key]}
                  disabled={busy}
                  onChange={(e) => setMetrics({ ...metrics, [key]: e.target.value.replace(/\D/g, '') })}
                />
              </label>
            ))}
          </div>
          <p className="muted">
            반응률(저장+공유 ÷ 도달): {rate === null ? '—' : `${(rate * 100).toFixed(1)}%`}
          </p>
          <button className="button" disabled={busy || !metrics.reach}>
            결과 저장
          </button>
        </form>
      )}
      {state && <p className="muted">{state}</p>}
    </section>
  );
}
