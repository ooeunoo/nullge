'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, CircleCheck, Circle, ExternalLink, Wallet } from 'lucide-react';
import {
  KRW_PER_USD,
  SPEND_CATEGORIES,
  SPEND_LABELS,
  isScheduled,
  type Dashboard,
  type Desk,
} from '@nullge/contracts';
import { api } from '../../lib/api';

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const KST = 9 * 3600_000;
const today = () => new Date(Date.now() + KST).toISOString().slice(0, 10);
const dday = (day: string) => {
  const diff = Math.round(
    (Date.parse(`${day}T00:00:00+09:00`) - Date.parse(`${today()}T00:00:00+09:00`)) / 86400_000,
  );
  return diff === 0 ? '오늘' : diff > 0 ? `D-${diff}` : `${-diff}일 지남`;
};
const shortDay = (day: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(`${day}T12:00:00+09:00`));

/** What only the operator can do, what is coming up, and what marketing costs this month. */
export function OperatorDesk({ data }: { data: Dashboard }) {
  const [desk, setDesk] = useState<Desk | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [spend, setSpend] = useState({ spentOn: today(), category: 'ads', amountKrw: '', note: '' }),
    [cap, setCap] = useState('');
  const load = () =>
    api<Desk>('desk')
      .then((d) => {
        setDesk(d);
        setCap(d.monthlyCapKrw === null ? '' : String(d.monthlyCapKrw));
      })
      .catch((e) => setError(e instanceof Error ? e.message : '불러오지 못했어요.'));
  useEffect(() => {
    void load();
  }, []);
  async function send(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }
  if (!desk)
    return error ? (
      <p role="alert" className="notice error">
        {error}
      </p>
    ) : null;
  const product = (id: string | null) => data.projects.find((p) => p.id === id);
  const todos = desk.tasks.filter((t) => t.kind === 'todo');
  const horizon = new Date(Date.now() + 60 * 86400_000 + KST).toISOString().slice(0, 10);
  const upcoming = [
    ...desk.tasks
      .filter((t) => t.kind !== 'todo' && t.status === 'open' && t.dueOn && t.dueOn <= horizon)
      .map((t) => ({ day: t.dueOn!, title: t.title, note: t.detail, link: t.link, kind: t.kind, id: t.id })),
    ...data.posts.filter(isScheduled).map((p) => ({
      day: new Date(new Date(p.scheduledAt!).getTime() + KST).toISOString().slice(0, 10),
      title: `게시 · ${p.title}`,
      note: product(p.projectId)?.name ?? '',
      link: null,
      kind: 'post' as const,
      id: p.id,
    })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  const manual = desk.spend.reduce((n, s) => n + s.amountKrw, 0);
  const generationKrw = desk.generationUsd * KRW_PER_USD;
  const total = manual + generationKrw;
  const byCategory = SPEND_CATEGORIES.map(
    (c) => [c, desk.spend.filter((s) => s.category === c).reduce((n, s) => n + s.amountKrw, 0)] as const,
  ).filter(([, v]) => v > 0);
  const ratio = desk.monthlyCapKrw ? Math.min(1, total / desk.monthlyCapKrw) : 0;

  return (
    <div className="desk">
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <section className="week-block" aria-labelledby="desk-todo">
        <h3 id="desk-todo">
          직접 해 주셔야 해요 <span className="count">{todos.filter((t) => t.status === 'open').length}</span>
        </h3>
        <p className="muted week-help">
          녹화·로그인·결제처럼 Claude가 대신할 수 없는 일만 모았어요. 끝나면 체크해 주세요.
        </p>
        {todos.length === 0 && <p className="week-empty">지금은 직접 하실 일이 없어요.</p>}
        {todos.map((t) => (
          <div className={`desk-task ${t.status}`} key={t.id}>
            <button
              className="desk-check"
              disabled={busy}
              aria-label={t.status === 'open' ? `${t.title} 완료로 표시` : `${t.title} 다시 열기`}
              onClick={() =>
                void send(() => api(`desk/tasks/${t.id}/${t.status === 'open' ? 'done' : 'reopen'}`, {}))
              }
            >
              {t.status === 'done' ? <CircleCheck size={19} /> : <Circle size={19} />}
            </button>
            <div className="week-text">
              <strong>{t.title}</strong>
              {(t.detail || product(t.projectId)) && (
                <span>
                  {product(t.projectId)?.name}
                  {product(t.projectId) && t.detail ? ' · ' : ''}
                  {t.detail}
                </span>
              )}
            </div>
            {t.link && (
              <a className="text-button" href={t.link} target="_blank" rel="noreferrer">
                방법 보기 <ExternalLink size={13} />
              </a>
            )}
          </div>
        ))}
      </section>

      <section className="week-block" aria-labelledby="desk-calendar">
        <h3 id="desk-calendar">
          <CalendarDays size={16} /> 다가오는 일정
        </h3>
        {upcoming.length === 0 && <p className="week-empty">60일 안에 잡힌 일정이 없어요.</p>}
        {upcoming.map((u) => (
          <div className={`desk-date ${u.kind}`} key={`${u.kind}:${u.id}`}>
            <span className="desk-day">
              {shortDay(u.day)}
              <small>{dday(u.day)}</small>
            </span>
            <div className="week-text">
              <strong>{u.title}</strong>
              {u.note && <span>{u.note}</span>}
            </div>
            {u.link && (
              <a className="text-button" href={u.link} target="_blank" rel="noreferrer">
                열기 <ExternalLink size={13} />
              </a>
            )}
          </div>
        ))}
      </section>

      <section className="week-block" aria-labelledby="desk-budget">
        <h3 id="desk-budget">
          <Wallet size={16} /> 이번 달 마케팅 비용 <span className="muted">{desk.month}</span>
        </h3>
        <div className="budget-line">
          <strong>{won(total)}</strong>
          <span className="muted">
            {desk.monthlyCapKrw ? ` / 상한 ${won(desk.monthlyCapKrw)}` : ' · 상한 미설정'}
          </span>
        </div>
        {desk.monthlyCapKrw ? (
          <div className={`budget-bar ${ratio >= 0.9 ? 'warn' : ''}`}>
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
        <ul className="budget-breakdown">
          <li>
            Console AI 생성 (추정) <span>{won(generationKrw)}</span>
            <small>
              ${desk.generationUsd.toFixed(2)} · 1달러 {KRW_PER_USD.toLocaleString('ko-KR')}원으로 계산
            </small>
          </li>
          {byCategory.map(([c, v]) => (
            <li key={c}>
              {SPEND_LABELS[c]} <span>{won(v)}</span>
            </li>
          ))}
        </ul>
        <div className="budget-actions">
          <button className="text-button" disabled={busy} onClick={() => setAdding(!adding)}>
            + 비용 기록
          </button>
          <label className="budget-cap">
            월 상한(원)
            <input
              inputMode="numeric"
              value={cap}
              disabled={busy}
              onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))}
              onBlur={() =>
                void send(() => api('desk/budget', { monthlyCapKrw: cap ? Number(cap) : null }, 'PATCH'))
              }
            />
          </label>
        </div>
        {adding && (
          <form
            className="budget-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send(async () => {
                await api('desk/spend', { ...spend, amountKrw: Number(spend.amountKrw), projectSlug: null });
                setSpend({ ...spend, amountKrw: '', note: '' });
                setAdding(false);
              });
            }}
          >
            <input
              type="date"
              value={spend.spentOn}
              onChange={(e) => setSpend({ ...spend, spentOn: e.target.value })}
            />
            <select value={spend.category} onChange={(e) => setSpend({ ...spend, category: e.target.value })}>
              {SPEND_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SPEND_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              required
              inputMode="numeric"
              placeholder="금액(원)"
              value={spend.amountKrw}
              onChange={(e) => setSpend({ ...spend, amountKrw: e.target.value.replace(/\D/g, '') })}
            />
            <input
              placeholder="메모"
              maxLength={200}
              value={spend.note}
              onChange={(e) => setSpend({ ...spend, note: e.target.value })}
            />
            <button className="button" disabled={busy || !spend.amountKrw}>
              기록
            </button>
          </form>
        )}
        {desk.spend.length > 0 && (
          <details className="budget-entries">
            <summary>이번 달 기록 {desk.spend.length}건</summary>
            {desk.spend.map((s) => (
              <div key={s.id}>
                {s.spentOn} · {SPEND_LABELS[s.category]} · {won(s.amountKrw)} {s.note && `· ${s.note}`}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void send(() => api(`desk/spend/${s.id}/delete`, {}))}
                >
                  삭제
                </button>
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}
