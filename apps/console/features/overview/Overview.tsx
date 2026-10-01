'use client';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { CHANNEL_LABELS, type Dashboard } from '@nullge/contracts';
import { Empty } from '../../components/ui/Empty';
import { Mark } from '../../components/ui/Mark';
import { date, projectPath } from '../../lib/api';

export function Overview({ data }: { data: Dashboard }) {
  const review = data.posts.filter((p) => p.status === 'approved' && !p.publishStatus);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORK, IN ONE PLACE</p>
          <h1>오늘의 작업 공간</h1>
          <p className="page-description">제품마다 다른 이야기, 한곳에서 이어가세요.</p>
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
      <section className="summary-row" aria-label="콘텐츠 현황">
        {[
          ['작성 중', data.posts.filter((p) => p.status === 'draft').length, '초안을 이어서 작성하세요'],
          ['게시 대기', review.length, '승인한 콘텐츠를 채널에 게시하세요'],
          [
            '게시됨',
            data.posts.filter((p) => p.publishStatus === 'published').length,
            '채널에 올라간 콘텐츠예요',
          ],
        ].map(([label, value, description]) => (
          <div className="summary" key={label}>
            <span>{label}</span>
            <strong>{value.toString().padStart(2, '0')}</strong>
            <p>{description}</p>
          </div>
        ))}
      </section>
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
            <h2>게시할 콘텐츠</h2>
            <span className="count">{review.length}</span>
          </div>
          {review.length ? (
            <div className="review-list">
              {review.slice(0, 5).map((post) => {
                const p = data.projects.find((x) => x.id === post.projectId)!;
                return (
                  <a key={post.id} href={`${projectPath(p)}/${post.id}`}>
                    <Mark project={p} />
                    <div>
                      <strong>{post.title}</strong>
                      <span>
                        {p.name} · {CHANNEL_LABELS[post.channel]}
                      </span>
                    </div>
                    <ChevronRight size={16} />
                  </a>
                );
              })}
            </div>
          ) : (
            <Empty title="게시를 기다리는 콘텐츠가 없어요.">
              <p>초안을 승인하면 여기에 모여요.</p>
            </Empty>
          )}
        </section>
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
