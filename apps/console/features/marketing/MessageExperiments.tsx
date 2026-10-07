'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, Plus, Trophy } from 'lucide-react';
import {
  MESSAGE_STATUS_LABELS,
  responseRate,
  type ContentMessage,
  type MessageStatus,
  type Project,
} from '@nullge/contracts';
import { call, message } from './shared';

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
/** How many measured posts each message needs before the comparison means anything. */
const ENOUGH = 3;

/**
 * Which message wins for this product. The research rule: compare saves plus shares per reach, and call a winner
 * only when it leads clearly (1.5x) with enough measured posts on each side.
 */
export function verdict(messages: ContentMessage[]) {
  const testing = messages.filter((m) => m.status === 'testing');
  const ranked = testing
    .map((m) => ({ m, rate: responseRate(m) }))
    .filter((x): x is { m: ContentMessage; rate: number } => x.rate !== null)
    .sort((a, b) => b.rate - a.rate);
  if (testing.length < 2)
    return '시험할 메시지를 두 개 이상 만들어 주세요. 같은 기간에 나란히 올려야 비교가 돼요.';
  if (ranked.length < 2) return '게시된 콘텐츠의 결과가 쌓이면 여기서 메시지를 비교해요.';
  const [first, second] = ranked;
  const ratio = second!.rate > 0 ? first!.rate / second!.rate : Infinity;
  const ready = ranked.every((x) => x.m.measured >= ENOUGH);
  if (!ready)
    return `지금은 "${first!.m.label}"이(가) 앞서요. 메시지마다 결과가 ${ENOUGH}개씩 쌓이면 판정할 수 있어요.`;
  if (ratio >= 1.5)
    return `"${first!.m.label}"이(가) 다음 메시지보다 ${ratio === Infinity ? '확실히' : `${ratio.toFixed(1)}배`} 반응이 좋아요. 이긴 메시지로 정해도 돼요.`;
  return '아직 확실한 차이가 없어요. 같은 메시지로 몇 개 더 올려 보거나, 첫 문장(훅)을 바꿔 시험해 보세요.';
}

export function MessageExperiments({ project }: { project: Project }) {
  const [rows, setRows] = useState<ContentMessage[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [label, setLabel] = useState(''),
    [description, setDescription] = useState('');
  const path = `projects/${project.slug}/messages`;
  const load = () =>
    call<ContentMessage[]>(path)
      .then(setRows)
      .catch((e) => setError(message(e)));
  useEffect(() => {
    void load();
  }, [path]);
  async function send(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const setStatus = (m: ContentMessage, status: MessageStatus) =>
    send(() => call(`${path}/${m.id}`, { status }, 'PATCH'));
  const best = Math.max(0, ...rows.map((m) => responseRate(m) ?? 0));
  return (
    <section className="panel experiments" aria-labelledby="experiments-title">
      <div className="section-title">
        <h2 id="experiments-title">
          <FlaskConical size={17} /> 메시지 실험
        </h2>
        <button className="text-button" disabled={busy} onClick={() => setAdding(!adding)}>
          <Plus size={14} /> 메시지 추가
        </button>
      </div>
      <p className="experiments-verdict">{verdict(rows)}</p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {adding && (
        <form
          className="experiments-add"
          onSubmit={(e) => {
            e.preventDefault();
            void send(async () => {
              await call(path, { label, description });
              setLabel('');
              setDescription('');
              setAdding(false);
            });
          }}
        >
          <label>
            메시지 이름
            <input
              required
              maxLength={60}
              value={label}
              placeholder="예: A 기억하는 친구"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            한 줄 설명
            <input
              maxLength={300}
              value={description}
              placeholder="예: 지난 대화를 기억하고 먼저 물어보는 친구"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy || !label.trim()}>
            추가
          </button>
        </form>
      )}
      {rows.length > 0 && (
        <div className="experiments-table" role="table" aria-label="메시지별 결과">
          <div className="experiments-row head" role="row">
            <span role="columnheader">메시지</span>
            <span role="columnheader">콘텐츠</span>
            <span role="columnheader">도달</span>
            <span role="columnheader">저장+공유</span>
            <span role="columnheader">반응률</span>
            <span role="columnheader">
              <span className="visually-hidden">관리</span>
            </span>
          </div>
          {rows.map((m) => {
            const rate = responseRate(m);
            return (
              <div className={`experiments-row ${m.status}`} role="row" key={m.id}>
                <span role="cell" className="experiments-name">
                  <strong>
                    {m.status === 'winner' && <Trophy size={14} />} {m.label}
                  </strong>
                  <small>
                    {MESSAGE_STATUS_LABELS[m.status]}
                    {m.description && ` · ${m.description}`}
                  </small>
                </span>
                <span role="cell">
                  {m.posts}개{' '}
                  <small>
                    게시 {m.published} · 측정 {m.measured}
                  </small>
                </span>
                <span role="cell">{m.reach.toLocaleString('ko-KR')}</span>
                <span role="cell">{(m.saves + m.shares).toLocaleString('ko-KR')}</span>
                <span role="cell" className="experiments-rate">
                  <span className="rate-bar">
                    <span style={{ width: `${best > 0 && rate ? Math.round((rate / best) * 100) : 0}%` }} />
                  </span>
                  {pct(rate)}
                </span>
                <span role="cell" className="experiments-actions">
                  {m.status !== 'winner' && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void setStatus(m, 'winner')}
                    >
                      이긴 메시지로
                    </button>
                  )}
                  {m.status === 'testing' ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void setStatus(m, 'dropped')}
                    >
                      그만두기
                    </button>
                  ) : (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void setStatus(m, 'testing')}
                    >
                      다시 시험
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
