'use client';
import { useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import {
  CHANNEL_TEST_LABELS,
  CHANNEL_TEST_STATUSES,
  type ChannelTest,
  type ChannelTestStatus,
  type Project,
} from '@nullge/contracts';
import { call, message } from './shared';

const KST = 9 * 3600_000;
const today = () => new Date(Date.now() + KST).toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + KST + n * 86400_000).toISOString().slice(0, 10);

/**
 * Bullseye board: list the channels you could use, test two or three cheaply for about two weeks with one pass
 * rule each, keep the one that works and stop the rest.
 */
export function ChannelBoard({ project }: { project: Project }) {
  const [rows, setRows] = useState<ChannelTest[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [form, setForm] = useState({ name: '', goal: '' });
  const path = `projects/${project.slug}/channel-tests`;
  const load = () =>
    call<ChannelTest[]>(path)
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
  const testing = rows.filter((r) => r.status === 'testing').length;
  const hint =
    rows.length === 0
      ? '써 볼 수 있는 채널을 적고, 둘~셋만 골라 2주씩 시험해요. 하나가 확실히 통하면 그 채널에 집중해요.'
      : testing > 3
        ? `시험 중인 채널이 ${testing}개예요. 1인 팀은 셋을 넘기지 않는 게 좋아요.`
        : rows.some((r) => r.status === 'testing' && r.endsOn && r.endsOn < today())
          ? '시험 기간이 끝난 채널이 있어요. 결과를 적고 유지할지 중단할지 정해 주세요.'
          : '시험 기간이 끝나면 결과를 적고 유지·중단을 정해요.';
  const setStatus = (r: ChannelTest, status: ChannelTestStatus) =>
    send(() =>
      call(
        `${path}/${r.id}`,
        status === 'testing' && !r.startedOn
          ? { status, startedOn: today(), endsOn: inDays(14) }
          : { status },
        'PATCH',
      ),
    );
  return (
    <section className="panel channel-board" aria-labelledby="board-title">
      <div className="section-title">
        <h2 id="board-title">
          <Target size={17} /> 채널 보드
        </h2>
        <button className="text-button" disabled={busy} onClick={() => setAdding(!adding)}>
          <Plus size={14} /> 채널 추가
        </button>
      </div>
      <p className="experiments-verdict">{hint}</p>
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
              await call(path, { name: form.name, goal: form.goal, status: 'idea' });
              setForm({ name: '', goal: '' });
              setAdding(false);
            });
          }}
        >
          <label>
            채널
            <input
              required
              maxLength={60}
              value={form.name}
              placeholder="예: Threads 한국어, Apple Ads"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            통과 기준
            <input
              maxLength={300}
              value={form.goal}
              placeholder="예: 2주 안에 저장+공유율 2% 이상"
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </label>
          <button className="button primary" disabled={busy || !form.name.trim()}>
            추가
          </button>
        </form>
      )}
      <div className="board-columns">
        {CHANNEL_TEST_STATUSES.map((status) => (
          <div className={`board-column ${status}`} key={status}>
            <h3>
              {CHANNEL_TEST_LABELS[status]}{' '}
              <span className="count">{rows.filter((r) => r.status === status).length}</span>
            </h3>
            {rows
              .filter((r) => r.status === status)
              .map((r) => (
                <article className="board-card" key={r.id}>
                  <strong>{r.name}</strong>
                  {r.goal && <p>기준 · {r.goal}</p>}
                  {(r.startedOn || r.endsOn) && (
                    <p className="muted">
                      {r.startedOn ?? '?'} ~ {r.endsOn ?? '?'}
                    </p>
                  )}
                  {r.result && <p>결과 · {r.result}</p>}
                  <div className="board-actions">
                    {status !== 'testing' && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void setStatus(r, 'testing')}
                      >
                        시험 시작
                      </button>
                    )}
                    {status === 'testing' && (
                      <>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void setStatus(r, 'keep')}
                        >
                          유지
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void setStatus(r, 'stopped')}
                        >
                          중단
                        </button>
                      </>
                    )}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        const result = window.prompt('결과를 한 줄로 적어 주세요.', r.result);
                        if (result !== null) void send(() => call(`${path}/${r.id}`, { result }, 'PATCH'));
                      }}
                    >
                      결과 적기
                    </button>
                  </div>
                </article>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
