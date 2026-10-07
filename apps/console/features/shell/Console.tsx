'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { type Dashboard } from '@nullge/contracts';
import { Empty } from '../../components/ui/Empty';
import { Mark } from '../../components/ui/Mark';
import { Editor } from '../content/Editor';
import { PostList } from '../content/PostList';
import { AutoCreator } from '../marketing/AutoCreator';
import { GenerationHistory } from '../marketing/GenerationHistory';
import { PublishPanel } from '../marketing/PublishPanel';
import { MessageExperiments } from '../marketing/MessageExperiments';
import { PostExperiment } from '../marketing/PostExperiment';
import { SharedSettings } from '../marketing/SharedSettings';
import { Overview } from '../overview/Overview';
import { ProductSettings } from '../settings/ProductSettings';
import { Profile } from '../settings/Profile';
import { Login } from './Login';
import { ApiError, api, projectPath, settingsPath } from '../../lib/api';

export function Console({ route }: { route: string[] }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await api<Dashboard>('dashboard');
      setData(next);
      setNeedsLogin(false);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNeedsLogin(true);
        setData(null);
      } else setError(e instanceof Error ? e.message : '서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, body);
      await refresh();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      await refresh();
      setNotice(success);
    } catch (e) {
      // Refresh first: a successful refresh clears the error banner.
      await refresh();
      setError(e instanceof Error ? e.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function mutate<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<T>(path, body, method);
      setDirty(false);
      await refresh();
      setNotice('저장했어요.');
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="connection-screen" aria-live="polite">
        <span className="wordmark">
          nullge<span>.</span>
        </span>
        <p>작업 공간을 불러오고 있어요.</p>
      </main>
    );
  if (needsLogin) return <Login onLogin={refresh} />;
  if (!data)
    return (
      <main className="connection-screen">
        <h1>작업 공간에 연결할 수 없어요.</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => void refresh()}>
          <RefreshCw size={16} />
          다시 연결
        </button>
      </main>
    );
  const project = route[0] === 'projects' ? data.projects.find((p) => p.slug === route[1]) : undefined;
  const requestedTab = route[2] || 'marketing';
  const tab = requestedTab === 'brand' || requestedTab === 'channels' ? 'settings' : requestedTab;
  const content = project ? data.posts.filter((p) => p.projectId === project.id) : data.posts;
  const post = route[3] && route[3] !== 'new' ? content.find((p) => p.id === route[3]) : undefined;
  const isSettings = route[0] === 'settings' && route.length === 1;
  const notFound =
    (route.length > 0 && route[0] !== 'login' && route[0] !== 'projects' && !isSettings) ||
    (route[0] === 'projects' &&
      (!project ||
        !['marketing', 'settings'].includes(tab) ||
        route.length > 4 ||
        (route[3] && route[3] !== 'new' && !post) ||
        (tab !== 'marketing' && route[3])));
  const editing = project && tab === 'marketing' && !!route[3];
  const legacySection = requestedTab === 'brand' || requestedTab === 'channels' ? requestedTab : undefined;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Nullge 전체 보기">
          <span className="wordmark">
            nullge<span>.</span>
          </span>
          <span className="console-label">CONSOLE</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a className={`nav-item ${!project && !isSettings ? 'active' : ''}`} href="/">
            <LayoutGrid size={18} />
            이번 주
          </a>
          <a className={`nav-item ${isSettings ? 'active' : ''}`} href="/settings">
            <SlidersHorizontal size={18} />
            공통 API 설정
          </a>
          <p className="nav-label">
            PRODUCTS <span>{data.projects.length.toString().padStart(2, '0')}</span>
          </p>
          {data.projects.map((p) => (
            <a
              className={`nav-item product-nav ${project?.id === p.id ? 'active' : ''}`}
              href={projectPath(p)}
              key={p.id}
            >
              <Mark project={p} />
              <span>{p.name}</span>
              <ChevronRight size={14} />
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-label">
            <span className="workspace-avatar">N</span>
            <div>
              <strong>Nullge</strong>
              <span>{data.mode === 'local' ? '로컬 작업공간' : '운영 작업공간'}</span>
            </div>
          </div>
          <button
            className="logout"
            onClick={() => {
              if (dirty && !window.confirm('저장하지 않은 변경이 있어요. 로그아웃할까요?')) return;
              void api('auth/logout', {})
                .then(() => {
                  setDirty(false);
                  return refresh();
                })
                .catch((e) => setError(e.message));
            }}
          >
            <LogOut size={15} />
            로그아웃
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="crumb">WORKSPACE</span>
            <ChevronRight size={14} />
            <span>{project?.name || '모든 제품'}</span>
          </div>
          <span className="operator">
            <ShieldCheck size={16} />
            {data.user.name}
          </span>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button onClick={() => setError('')} aria-label="오류 메시지 닫기">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice success">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice('')} aria-label="알림 닫기">
                ×
              </button>
            </div>
          )}
          {notFound ? (
            <Empty title="페이지를 찾을 수 없어요.">
              <a className="button" href="/">
                전체 보기로 돌아가기
              </a>
            </Empty>
          ) : project ? (
            <>
              <div className="page-heading">
                <div className="project-heading">
                  <Mark project={project} large />
                  <div>
                    <p className="eyebrow">{tab === 'settings' ? 'PRODUCT SETTINGS' : 'PRODUCT WORKSPACE'}</p>
                    <h1>
                      {project.name}
                      {tab === 'settings' && <span className="heading-suffix"> 설정</span>}
                    </h1>
                  </div>
                </div>
                {!editing && tab === 'marketing' && (
                  <div className="heading-actions">
                    <a className="button primary" href={`${projectPath(project)}/new`}>
                      <Plus size={17} />
                      콘텐츠 생성
                    </a>
                    <a className="button" href={settingsPath(project)}>
                      <Settings size={17} />
                      설정
                    </a>
                  </div>
                )}
                {tab === 'settings' && (
                  <a className="button" href={projectPath(project)}>
                    <ArrowLeft size={16} />
                    콘텐츠로 돌아가기
                  </a>
                )}
              </div>
              {tab === 'marketing' &&
                (editing ? (
                  post ? (
                    <>
                      <Editor
                        key={`${project.id}:${post.id}:${post.revision}`}
                        project={project}
                        post={post}
                        busy={busy || !!post.publishStatus}
                        dirty={dirty}
                        setDirty={setDirty}
                        mutate={mutate}
                        notify={setNotice}
                      />
                      {!dirty && <PublishPanel project={project} post={post} />}
                      {!dirty && (
                        <PostExperiment key={`${post.id}:${post.revision}`} project={project} post={post} />
                      )}
                    </>
                  ) : (
                    <AutoCreator
                      project={project}
                      manual={
                        <Editor
                          project={project}
                          busy={busy}
                          dirty={dirty}
                          setDirty={setDirty}
                          mutate={mutate}
                          notify={setNotice}
                        />
                      }
                    />
                  )
                ) : (
                  <>
                    <MessageExperiments project={project} />
                    <PostList projects={[project]} posts={content} project={project} act={act} busy={busy} />
                    <details className="history-details">
                      <summary>자동 생성 작업 이력</summary>
                      <GenerationHistory project={project} />
                    </details>
                  </>
                ))}
              {tab === 'settings' && (
                <ProductSettings project={project} initialSection={legacySection}>
                  <Profile
                    key={`${project.id}:${project.revision}:${project.profileReviewedAt}`}
                    project={project}
                    busy={busy}
                    dirty={dirty}
                    setDirty={setDirty}
                    mutate={mutate}
                  />
                </ProductSettings>
              )}
            </>
          ) : isSettings ? (
            <SharedSettings />
          ) : (
            <Overview data={data} run={run} busy={busy} />
          )}
        </main>
        <footer className="main-footer">
          <span>Nullge Console</span>
          <span>표시 시간대 · 서울 (KST)</span>
        </footer>
      </div>
    </div>
  );
}
