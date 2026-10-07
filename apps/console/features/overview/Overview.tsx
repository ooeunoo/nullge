'use client';
import { ArrowUpRight } from 'lucide-react';
import { type Dashboard } from '@nullge/contracts';
import { Mark } from '../../components/ui/Mark';
import { date, projectPath } from '../../lib/api';
import { ThisWeek } from './ThisWeek';
import { OperatorDesk } from './OperatorDesk';

export function Overview({
  data,
  run,
  busy,
}: {
  data: Dashboard;
  run: (task: () => Promise<unknown>, success: string) => Promise<void>;
  busy: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THIS WEEK</p>
          <h1>이번 주</h1>
          <p className="page-description">결정할 것만 모았어요. 나머지는 예약된 대로 진행돼요.</p>
        </div>
        <span className="date-label">
          {new Intl.DateTimeFormat('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            timeZone: 'Asia/Seoul',
          }).format(new Date())}
        </span>
      </div>
      <ThisWeek data={data} run={run} busy={busy} />
      <OperatorDesk data={data} />
      <section className="section">
        <div className="section-title">
          <h2>우리의 제품</h2>
          <span className="muted">{data.projects.length}개 제품</span>
        </div>
        <div className="project-grid">
          {data.projects.map((p) => (
            <a className="project-card" href={projectPath(p)} key={p.id}>
              <div className="project-card-top">
                <Mark project={p} large />
                <ArrowUpRight size={19} />
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="project-card-bottom">
                <span>콘텐츠 {data.posts.filter((x) => x.projectId === p.id).length}개</span>
                <span className={p.profileReviewedAt ? 'ready-label' : 'muted'}>
                  {p.profileReviewedAt ? '프로필 확인됨' : '프로필 확인 필요'}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
      <div className="overview-bottom">
        <section className="panel">
          <div className="section-title">
            <h2>최근 작업</h2>
          </div>
          {data.activities.length ? (
            <ol className="activity-list">
              {data.activities.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className="activity-line" />
                  <div>
                    <strong>{a.title}</strong>
                    <p>
                      {(
                        {
                          post_created: '초안 작성',
                          post_updated: '콘텐츠 수정',
                          post_review: '검토 요청',
                          post_approve: '승인',
                          post_reopen: '초안으로 되돌림',
                          post_deleted: '콘텐츠 삭제',
                          post_published_externally: '직접 게시 기록',
                          post_scheduled: '게시 예약',
                          post_unscheduled: '예약 취소',
                          post_message_tagged: '메시지 지정',
                          post_metrics_recorded: '결과 기록',
                          message_created: '메시지 추가',
                          message_updated: '메시지 수정',
                          message_winner: '이긴 메시지로 지정',
                          message_dropped: '메시지 그만둠',
                          message_testing: '메시지 다시 시험',
                          marketing_action: '마케팅 작업',
                          profile_imported: '저장소 기반 기본 설정',
                          profile_corrected: '제품 저장소 정정',
                          profile_updated: '제품 정보 변경',
                          profile_reviewed: '제품 정보 확인',
                        } as Record<string, string>
                      )[a.action] || a.action}{' '}
                      · {date(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-activity">콘텐츠와 제품 정보를 저장하면 여기에 기록돼요.</p>
          )}
        </section>
      </div>
    </>
  );
}
