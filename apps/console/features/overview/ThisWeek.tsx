'use client';
import { useState } from 'react';
import { CalendarClock, Check, ExternalLink, X } from 'lucide-react';
import { CHANNEL_LABELS, LANGUAGE_LABELS, isScheduled, type Dashboard, type Post } from '@nullge/contracts';
import { Mark } from '../../components/ui/Mark';
import { api, date, projectPath, settingsPath } from '../../lib/api';
import { approveAndSchedule, suggestSlots } from '../../lib/schedule';

const FORMAT_LABELS = { text: '글', image: '이미지', video: '영상' } as const;
const WEEK = 7 * 86400_000;

/**
 * The operator's home: what needs a decision this week, what is planned, and what went out. Everything else in
 * the console is a place to go only when a card here sends you there.
 */
export function ThisWeek({
  data,
  run,
  busy,
}: {
  data: Dashboard;
  run: (task: () => Promise<unknown>, success: string) => Promise<void>;
  busy: boolean;
}) {
  const project = (p: Post) => data.projects.find((x) => x.id === p.projectId)!;
  const drafts = data.posts.filter((p) => p.status === 'draft' && !p.publishStatus);
  const scheduled = data.posts
    .filter(isScheduled)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const failed = data.posts.filter(
    (p) => p.publishError && !p.publishStatus && !isScheduled(p) && p.status === 'approved',
  );
  const published = data.posts.filter(
    (p) => p.publishStatus === 'published' && Date.now() - new Date(p.updatedAt).getTime() < WEEK,
  );
  const [slots, setSlots] = useState<Record<string, string>>({});
  const suggested = suggestSlots(drafts, data.posts);
  const slotOf = (p: Post) => slots[p.id] ?? suggested[p.id];
  const [more, setMore] = useState(false);
  const shown = more ? drafts : drafts.slice(0, 6);
  /** Why a draft cannot be approved yet, in plain words, with the one place that fixes it. */
  const blocker = (p: Post) => {
    const pr = project(p);
    if (!pr.profileReviewedAt)
      return {
        text: '제품 정보를 한 번 확인해 주셔야 승인할 수 있어요.',
        href: settingsPath(pr, 'brand'),
        cta: '제품 정보 확인',
      };
    if (p.profileRevision !== pr.revision)
      return {
        text: '제품 정보가 바뀌어서 이 콘텐츠를 한 번 다시 저장해야 해요.',
        href: `${projectPath(pr)}/${p.id}`,
        cta: '열어서 저장',
      };
    if (!p.caption.trim())
      return { text: '본문이 비어 있어요.', href: `${projectPath(pr)}/${p.id}`, cta: '본문 쓰기' };
    return null;
  };
  const line = (p: Post) =>
    `${project(p).name} · ${CHANNEL_LABELS[p.channel]} ${LANGUAGE_LABELS[p.language]} · ${FORMAT_LABELS[p.format || 'text']}`;

  return (
    <section className="this-week" aria-labelledby="this-week-title">
      <div className="section-title">
        <h2 id="this-week-title">이번 주 할 일</h2>
        <span className="muted">
          결정 {drafts.length + failed.length}개 · 예약 {scheduled.length}개
        </span>
      </div>

      {failed.length > 0 && (
        <div className="week-block">
          <h3>다시 확인이 필요해요</h3>
          {failed.map((p) => (
            <div className="week-row attention" key={p.id}>
              <Mark project={project(p)} />
              <div className="week-text">
                <strong>{p.title}</strong>
                <span>{p.publishError}</span>
              </div>
              <a className="button" href={`${projectPath(project(p))}/${p.id}`}>
                열어 보기
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="week-block">
        <h3>
          승인이 필요해요 <span className="count">{drafts.length}</span>
        </h3>
        <p className="muted week-help">
          내용이 괜찮으면 시간을 확인하고 &quot;승인하고 예약&quot;을 누르세요. 그 시간에 자동으로 올라가요.
        </p>
        {drafts.length === 0 && <p className="week-empty">지금은 결정할 콘텐츠가 없어요.</p>}
        {shown.map((p) => (
          <div className="week-row" key={p.id}>
            {p.assetId && p.format === 'image' ? (
              <img className="week-thumb" src={`/api/assets/${p.assetId}?w=160`} alt="" loading="lazy" />
            ) : p.posterAssetId ? (
              <img
                className="week-thumb"
                src={`/api/assets/${p.posterAssetId}?w=160`}
                alt=""
                loading="lazy"
              />
            ) : (
              <Mark project={project(p)} />
            )}
            <div className="week-text">
              <strong>{p.title}</strong>
              <span>{line(p)}</span>
            </div>
            {blocker(p) ? (
              <div className="week-blocked">
                <span>{blocker(p)!.text}</span>
                <a className="button" href={blocker(p)!.href}>
                  {blocker(p)!.cta}
                </a>
              </div>
            ) : (
              <>
                <label className="week-time">
                  <span className="visually-hidden">{p.title} 게시 시각</span>
                  <input
                    type="datetime-local"
                    value={slotOf(p)}
                    disabled={busy}
                    onChange={(e) => setSlots({ ...slots, [p.id]: e.target.value })}
                  />
                </label>
                <div className="week-actions">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => approveAndSchedule(project(p).slug, p, slotOf(p)),
                        `"${p.title}"을 승인하고 예약했어요.`,
                      )
                    }
                  >
                    <Check size={15} />
                    승인하고 예약
                  </button>
                  <a className="button" href={`${projectPath(project(p))}/${p.id}`}>
                    열어 보기
                  </a>
                </div>
              </>
            )}
          </div>
        ))}
        {drafts.length > 6 && (
          <button className="text-button" onClick={() => setMore(!more)}>
            {more ? '접기' : `${drafts.length - 6}개 더 보기`}
          </button>
        )}
      </div>

      <div className="week-block">
        <h3>
          예약된 게시 <span className="count">{scheduled.length}</span>
        </h3>
        {scheduled.length === 0 && <p className="week-empty">예약된 콘텐츠가 없어요.</p>}
        {scheduled.map((p) => (
          <div className="week-row" key={p.id}>
            <span className="week-when">
              <CalendarClock size={15} />
              {date(p.scheduledAt!)}
            </span>
            <div className="week-text">
              <strong>{p.title}</strong>
              <span>{line(p)}</span>
            </div>
            <div className="week-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      api(`projects/${project(p).slug}/posts/${p.id}/unschedule`, { revision: p.revision }),
                    '예약을 취소했어요. 승인 상태는 그대로예요.',
                  )
                }
              >
                <X size={15} />
                예약 취소
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="week-block">
        <h3>
          이번 주 게시됨 <span className="count">{published.length}</span>
        </h3>
        {published.length === 0 && <p className="week-empty">최근 7일 동안 게시된 콘텐츠가 없어요.</p>}
        {published.map((p) => (
          <div className="week-row" key={p.id}>
            <Mark project={project(p)} />
            <div className="week-text">
              <strong>{p.title}</strong>
              <span>
                {line(p)} · {date(p.updatedAt)}
              </span>
            </div>
            {p.publishedUrl && (
              <a className="text-button" href={p.publishedUrl} target="_blank" rel="noreferrer">
                게시물 보기 <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
