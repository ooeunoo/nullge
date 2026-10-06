'use client';
import { useEffect, useState } from 'react';
import { ChevronRight, CircleHelp, Plus, Search } from 'lucide-react';
import { type Post, type Project } from '@nullge/contracts';
import { Empty } from '../../components/ui/Empty';
import { PostCard } from './PostCard';
import { type Act, type ConnectionLite } from './types';
import { api, projectPath, settingsPath } from '../../lib/api';

export function PostList({
  posts,
  projects,
  project,
  act,
  busy,
}: {
  posts: Post[];
  projects: Project[];
  project: Project;
  act: Act;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [connections, setConnections] = useState<ConnectionLite[]>([]);
  useEffect(() => {
    api<ConnectionLite[]>(`projects/${project.slug}/channels`)
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [project.slug, posts.length]);
  const visible = posts.filter(
    (p) =>
      (status === 'all' || p.status === status) &&
      (channel === 'all' || p.channel === channel) &&
      `${p.title} ${p.caption}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="content-toolbar">
        <div className="status-filters" aria-label="콘텐츠 상태">
          {[
            ['all', '전체'],
            ['draft', '초안'],
            ['approved', '승인됨'],
          ].map(([s, label]) => (
            <button
              className={s === status ? 'selected' : ''}
              key={s}
              onClick={() => setStatus(s)}
              aria-pressed={s === status}
            >
              {label}
              <span>{s === 'all' ? posts.length : posts.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <div className="status-filters channel-filters" aria-label="채널">
            {[
              ['all', '모든 채널'],
              ['instagram', 'Instagram'],
              ['threads', 'Threads'],
              ['x', 'X'],
            ].map(([c, label]) => (
              <button
                className={c === channel ? 'selected' : ''}
                key={c}
                onClick={() => setChannel(c)}
                aria-pressed={c === channel}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="콘텐츠 검색"
              placeholder="콘텐츠 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </div>
      {!project.profileReviewedAt && (
        <div className="inline-note">
          <CircleHelp size={17} />
          <span>제품 정보를 확인하면 콘텐츠 검토를 완료할 수 있어요.</span>
          <a href={settingsPath(project, 'brand')}>
            정보 확인
            <ChevronRight size={15} />
          </a>
        </div>
      )}
      {visible.length ? (
        <div className="post-grid">
          {visible.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              project={project}
              connection={connections.find((c) => c.channel === post.channel && c.language === post.language)}
              act={act}
              busy={busy}
            />
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title={
              query || status !== 'all' || channel !== 'all'
                ? '조건에 맞는 콘텐츠가 없어요.'
                : '첫 이야기를 만들어 볼까요?'
            }
          >
            <p>
              {query || status !== 'all' || channel !== 'all'
                ? '검색어나 필터를 바꿔 보세요.'
                : `${project.name}의 기능이나 활용 장면을 짧은 글로 시작해 보세요.`}
            </p>
            {!query && status === 'all' && channel === 'all' && (
              <a className="button" href={`${projectPath(project)}/new`}>
                <Plus size={16} />첫 콘텐츠 작성
              </a>
            )}
          </Empty>
        </section>
      )}
    </>
  );
}
