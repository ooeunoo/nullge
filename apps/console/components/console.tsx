'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleHelp, Copy, FileText, LayoutGrid, LogOut, Plus, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { CHANNEL_LABELS, STATUS_LABELS, MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES, type AuthOptions, type Dashboard, type Post, type PostInput, type Project, type ProfileInput } from '@nullge/contracts';
import { productBrands } from './product-brands';
import { SharedSettings,ProductChannels,AutoCreator,GenerationHistory,PublishPanel } from './marketing';

class ApiError extends Error { constructor(message: string,readonly status: number) { super(message); } }
async function api<T>(path: string,body?: unknown,method='POST'): Promise<T> {
  const response=await fetch(`/api/${path}`,{ method:body===undefined?'GET':method,cache:'no-store',headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body) });
  const data=await response.json();
  if (!response.ok) throw new ApiError(data.message || '요청을 처리하지 못했습니다.',response.status);
  return data as T;
}
const projectPath=(project: Project,tab='marketing')=>`/projects/${project.slug}/${tab}`;
const settingsPath=(project: Project,section?: 'brand'|'channels')=>`${projectPath(project,'settings')}${section?`#${section}`:''}`;
const date=(value: string)=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));
function Mark({ project,large=false }: { project: Project; large?: boolean }) {
  const brand=productBrands[project.slug];
  const [failed,setFailed]=useState(false);
  return <span className={`project-mark ${large?'large':''}`} style={{background:brand&&!failed?'#fff':project.color}} aria-hidden="true">{brand&&!failed?<img src={brand.logo} alt="" width={large?56:28} height={large?56:28} onError={()=>setFailed(true)}/>:project.name.slice(0,1).toLowerCase()}</span>;
}
function Badge({ status }: { status: Post['status'] }) { return <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>; }
function Empty({ title,children }: { title: string; children: React.ReactNode }) { return <div className="empty"><FileText size={30} strokeWidth={1.3}/><h3>{title}</h3>{children}</div>; }

export function Console({ route }: { route: string[] }) {
  const [data,setData]=useState<Dashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [needsLogin,setNeedsLogin]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try { const next=await api<Dashboard>('dashboard'); setData(next);setNeedsLogin(false);setError(''); }
    catch(e) { if (e instanceof ApiError && e.status===401) {setNeedsLogin(true);setData(null);} else setError(e instanceof Error?e.message:'서버에 연결할 수 없습니다.'); }
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if (!dirty) return;
    const unload=(event: BeforeUnloadEvent)=>{event.preventDefault();};
    window.addEventListener('beforeunload',unload);
    return ()=>window.removeEventListener('beforeunload',unload);
  },[dirty]);
  async function act(path: string,body: unknown,success: string) {
    setBusy(true);setError('');setNotice('');
    try {await api(path,body);await refresh();setNotice(success);}
    catch(e) {setError(e instanceof Error?e.message:'요청을 처리하지 못했습니다.');}
    finally {setBusy(false);}
  }
  async function mutate<T>(path: string,body: unknown,method='POST'): Promise<T> {
    setBusy(true);setError('');setNotice('');
    try {const result=await api<T>(path,body,method);setDirty(false);await refresh();setNotice('저장했어요.');return result;}
    catch(e) {setError(e instanceof Error?e.message:'저장하지 못했습니다.');throw e;}
    finally {setBusy(false);}
  }
  if (loading) return <main className="connection-screen" aria-live="polite"><span className="wordmark">nullge<span>.</span></span><p>작업 공간을 불러오고 있어요.</p></main>;
  if (needsLogin) return <Login onLogin={refresh}/>;
  if (!data) return <main className="connection-screen"><h1>작업 공간에 연결할 수 없어요.</h1><p role="alert">{error}</p><button className="button" onClick={()=>void refresh()}><RefreshCw size={16}/>다시 연결</button></main>;
  const project=route[0]==='projects'?data.projects.find(p=>p.slug===route[1]):undefined;
  const requestedTab=route[2] || 'marketing';
  const tab=requestedTab==='brand'||requestedTab==='channels'?'settings':requestedTab;
  const content=project?data.posts.filter(p=>p.projectId===project.id):data.posts;
  const post=route[3] && route[3]!=='new'?content.find(p=>p.id===route[3]):undefined;
  const isSettings=route[0]==='settings'&&route.length===1;
  const notFound=(route.length>0 && route[0]!=='login' && route[0]!=='projects' && !isSettings) || (route[0]==='projects' && (!project || !['marketing','settings'].includes(tab) || route.length>4 || (route[3] && route[3]!=='new' && !post) || (tab!=='marketing' && route[3])));
  const editing=project && tab==='marketing' && !!route[3];
  const legacySection=requestedTab==='brand'||requestedTab==='channels'?requestedTab:undefined;
  return <div className="app-shell">
    <a className="skip-link" href="#main">본문으로 이동</a>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Nullge 전체 보기"><span className="wordmark">nullge<span>.</span></span><span className="console-label">CONSOLE</span></a>
      <nav aria-label="주요 메뉴"><a className={`nav-item ${!project&&!isSettings?'active':''}`} href="/"><LayoutGrid size={18}/>전체 보기</a><a className={`nav-item ${isSettings?'active':''}`} href="/settings"><SlidersHorizontal size={18}/>공통 API 설정</a>
        <p className="nav-label">PRODUCTS <span>{data.projects.length.toString().padStart(2,'0')}</span></p>
        {data.projects.map(p=><a className={`nav-item product-nav ${project?.id===p.id?'active':''}`} href={projectPath(p)} key={p.id}><Mark project={p}/><span>{p.name}</span><ChevronRight size={14}/></a>)}
      </nav>
      <div className="sidebar-bottom"><div className="workspace-label"><span className="workspace-avatar">N</span><div><strong>Nullge</strong><span>{data.mode==='local'?'로컬 작업공간':'운영 작업공간'}</span></div></div><button className="logout" onClick={()=>{if(dirty&&!window.confirm('저장하지 않은 변경이 있어요. 로그아웃할까요?'))return;void api('auth/logout',{}).then(()=>{setDirty(false);return refresh();}).catch(e=>setError(e.message));}}><LogOut size={15}/>로그아웃</button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div><span className="crumb">WORKSPACE</span><ChevronRight size={14}/><span>{project?.name || '모든 제품'}</span></div><span className="operator"><ShieldCheck size={16}/>{data.user.name}</span></header>
      <main id="main" className="main-content">
        {error && <div role="alert" className="notice error">{error}<button onClick={()=>setError('')} aria-label="오류 메시지 닫기">×</button></div>}
        {notice && <div role="status" className="notice success"><Check size={16}/>{notice}<button onClick={()=>setNotice('')} aria-label="알림 닫기">×</button></div>}
        {notFound ? <Empty title="페이지를 찾을 수 없어요."><a className="button" href="/">전체 보기로 돌아가기</a></Empty> : project ? <>
          <div className="page-heading"><div className="project-heading"><Mark project={project} large/><div><p className="eyebrow">{tab==='settings'?'PRODUCT SETTINGS':'PRODUCT WORKSPACE'}</p><h1>{project.name}{tab==='settings'&&<span className="heading-suffix"> 설정</span>}</h1></div></div>
            {!editing && tab==='marketing' && <div className="heading-actions"><a className="button primary" href={`${projectPath(project)}/new`}><Plus size={17}/>콘텐츠 생성</a><a className="button" href={settingsPath(project)}><Settings size={17}/>설정</a></div>}
            {tab==='settings' && <a className="button" href={projectPath(project)}><ArrowLeft size={16}/>콘텐츠로 돌아가기</a>}
          </div>
          {tab==='marketing' && (editing?post?<><Editor key={`${project.id}:${post.id}:${post.revision}`} project={project} post={post} busy={busy||!!post.publishStatus} dirty={dirty} setDirty={setDirty} mutate={mutate} notify={setNotice}/>{!dirty&&<PublishPanel project={project} post={post}/>}</>:<AutoCreator project={project} manual={<Editor project={project} busy={busy} dirty={dirty} setDirty={setDirty} mutate={mutate} notify={setNotice}/>}/>:<><PostList projects={[project]} posts={content} project={project} act={act} busy={busy}/><details className="history-details"><summary>자동 생성 작업 이력</summary><GenerationHistory project={project}/></details></>)}
          {tab==='settings' && <ProductSettings project={project} initialSection={legacySection}><Profile key={`${project.id}:${project.revision}:${project.profileReviewedAt}`} project={project} busy={busy} dirty={dirty} setDirty={setDirty} mutate={mutate}/></ProductSettings>}
        </>:isSettings?<SharedSettings/>:<Overview data={data}/>}
      </main><footer className="main-footer"><span>Nullge Console</span><span>표시 시간대 · 서울 (KST)</span></footer>
    </div>
  </div>;
}

function Login({onLogin}:{onLogin:()=>Promise<void>}) {
  const [options,setOptions]=useState<AuthOptions|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{api<AuthOptions>('auth/options').then(setOptions).catch(e=>setError(e.message));if(new URLSearchParams(window.location.search).has('error'))setError('로그인을 확인하지 못했어요. 허용된 운영자 계정으로 다시 시도해 주세요.');},[]);
  return <main className="login-page"><div className="login-card"><span className="wordmark">nullge<span>.</span></span><p className="eyebrow">CONSOLE</p><h1>제품은 여러 개,<br/>작업은 한곳에서.</h1><p>ClipIt · minimo · mellow · Movy · desk</p>{error&&<p role="alert">{error}</p>}{!options&&<p>로그인 방법을 확인하고 있어요.</p>}{options?.google&&<a className="button primary" href="/api/auth/google">Google로 운영자 로그인</a>}{options?.local&&<><button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);try{await api('auth/local',{});await onLogin();}catch(e){setError(e instanceof Error?e.message:'로그인하지 못했습니다.');}finally{setBusy(false);}}}>{busy?'연결 중…':'로컬 작업공간 열기'}<ArrowUpRight size={17}/></button><p className="muted">이 기기의 개발 DB를 사용해요. 실제 SNS에는 게시되지 않아요.</p></>}{options&&!options.local&&!options.google&&<p className="muted">운영자 로그인 설정을 준비하고 있어요.</p>}</div></main>;
}

function Overview({data}:{data:Dashboard}) {
  const review=data.posts.filter(p=>p.status==='review');
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR WORK, IN ONE PLACE</p><h1>오늘의 작업 공간</h1><p className="page-description">제품마다 다른 이야기, 한곳에서 이어가세요.</p></div><span className="date-label">{new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date())}</span></div>
    <section className="summary-row" aria-label="콘텐츠 현황">{[['작성 중',data.posts.filter(p=>p.status==='draft').length,'초안을 이어서 작성하세요'],['검토 대기',review.length,'문구와 제품 정보를 확인하세요'],['검토 완료',data.posts.filter(p=>p.status==='approved').length,'채널 연결 후 발행을 준비하세요']].map(([label,value,description])=><div className="summary" key={label}><span>{label}</span><strong>{value.toString().padStart(2,'0')}</strong><p>{description}</p></div>)}</section>
    <section className="section"><div className="section-title"><h2>우리의 제품</h2><span className="muted">{data.projects.length}개 제품</span></div><div className="project-grid">{data.projects.map(p=><a className="project-card" href={projectPath(p)} key={p.id}><div className="project-card-top"><Mark project={p} large/><ArrowUpRight size={19}/></div><h3>{p.name}</h3><p>{p.description}</p><div className="project-card-bottom"><span>콘텐츠 {data.posts.filter(x=>x.projectId===p.id).length}개</span><span className={p.profileReviewedAt?'ready-label':'muted'}>{p.profileReviewedAt?'프로필 확인됨':'프로필 확인 필요'}</span></div></a>)}</div></section>
    <div className="overview-bottom"><section className="panel"><div className="section-title"><h2>검토할 콘텐츠</h2><span className="count">{review.length}</span></div>{review.length?<div className="review-list">{review.slice(0,5).map(post=>{const p=data.projects.find(x=>x.id===post.projectId)!;return <a key={post.id} href={`${projectPath(p)}/${post.id}`}><Mark project={p}/><div><strong>{post.title}</strong><span>{p.name} · {CHANNEL_LABELS[post.channel]}</span></div><ChevronRight size={16}/></a>;})}</div>:<Empty title="검토할 콘텐츠가 없어요."><p>제품을 선택해 첫 초안을 작성해 보세요.</p></Empty>}</section><section className="panel"><div className="section-title"><h2>최근 작업</h2></div>{data.activities.length?<ol className="activity-list">{data.activities.slice(0,6).map(a=><li key={a.id}><span className="activity-line"/><div><strong>{a.title}</strong><p>{({post_created:'초안 작성',post_updated:'콘텐츠 수정',post_review:'검토 요청',post_approve:'문구 검토 완료',post_reopen:'초안으로 되돌림',post_deleted:'콘텐츠 삭제',profile_imported:'저장소 기반 기본 설정',profile_corrected:'제품 저장소 정정',profile_updated:'제품 정보 변경',profile_reviewed:'제품 정보 확인'} as Record<string,string>)[a.action] || a.action} · {date(a.createdAt)}</p></div></li>)}</ol>:<p className="empty-activity">콘텐츠와 제품 정보를 저장하면 여기에 기록돼요.</p>}</section></div>
  </>;
}

const FORMAT_LABELS:Record<string,string>={text:'글',image:'이미지',video:'영상'};
function ChannelMark({channel}:{channel:Post['channel']}) {
  return <span className={`channel-mark ${channel}`} aria-label={CHANNEL_LABELS[channel]} title={CHANNEL_LABELS[channel]}>{channel==='x'?'𝕏':channel==='threads'?'@':'◎'}</span>;
}
type Act=(path:string,body:unknown,success:string)=>Promise<void>;
type ConnectionLite={channel:Post['channel'];connected:boolean;username:string|null;revision:number};
function PostCard({post,project,connection,act,busy}:{post:Post;project:Project;connection?:ConnectionLite;act:Act;busy:boolean}) {
  const [confirming,setConfirming]=useState(false);
  const format=post.format||'text';
  const media=format==='image'&&post.assetId?<img src={`/api/assets/${post.assetId}?w=480`} alt="" loading="lazy"/>
    :format==='video'&&post.assetId?<>{post.posterAssetId?<img src={`/api/assets/${post.posterAssetId}?w=480`} alt="" loading="lazy"/>:<video src={`/api/assets/${post.assetId}#t=0.2`} muted playsInline preload="auto"/>}<span className="play-badge" aria-hidden="true">▶</span></>
    :<div className={`text-card ${post.channel}`}><div className="text-card-head"><Mark project={project}/><strong>{project.name}</strong></div><p>{post.caption||'본문을 작성해 주세요.'}</p></div>;
  const base=`projects/${project.slug}/posts/${post.id}`;
  const publishState=post.publishStatus?({queued:'게시 대기',creating:'게시 준비',processing:'게시 중',submitting:'게시 중',published:'게시됨',failed:'게시 실패',uncertain:'확인 필요'} as Record<string,string>)[post.publishStatus]:null;
  const actions=post.publishStatus?(post.publishedUrl?<a className="text-button" href={post.publishedUrl} target="_blank" rel="noreferrer">게시물 열기<ArrowUpRight size={13}/></a>:<span className="muted">{publishState}</span>)
    :post.status==='draft'?<button className="button small" disabled={busy||!post.caption.trim()} onClick={()=>void act(`${base}/review`,{revision:post.revision},'검토 대기로 보냈어요.')}>검토 요청</button>
    :post.status==='review'?<><button className="button small primary" disabled={busy||!project.profileReviewedAt} onClick={()=>void act(`${base}/approve`,{revision:post.revision},'검토를 완료했어요.')}><Check size={14}/>승인</button><button className="text-button" disabled={busy} onClick={()=>void act(`${base}/reopen`,{revision:post.revision},'초안으로 되돌렸어요.')}>초안으로</button></>
    :!connection?.connected?<a className="text-button" href={settingsPath(project,'channels')}>채널 연결 후 게시<ArrowUpRight size={13}/></a>
    :confirming?<div className="publish-inline"><span>@{connection.username}에 지금 게시할까요?</span><div><button className="button small primary" disabled={busy} onClick={()=>{setConfirming(false);void act(`${base}/publish`,{revision:post.revision,connectionRevision:connection.revision,confirmed:true},'게시를 요청했어요.');}}>게시 확정</button><button className="button small" disabled={busy} onClick={()=>setConfirming(false)}>취소</button></div></div>
    :<><button className="button small primary" disabled={busy} onClick={()=>setConfirming(true)}><ArrowUpRight size={14}/>게시</button><button className="text-button" disabled={busy} onClick={()=>void act(`${base}/reopen`,{revision:post.revision},'초안으로 되돌렸어요.')}>초안으로</button></>;
  return <article className={`post-card ${post.status}`}>
    <a className="post-card-link" href={`${projectPath(project)}/${post.id}`}>
      <div className={`post-media ${format}`}>{media}
        <div className="post-media-top"><ChannelMark channel={post.channel}/><Badge status={post.status}/></div>
        {publishState&&<span className={`publish-chip ${post.publishStatus}`}>{publishState}</span>}
      </div>
      <div className="post-card-body"><strong>{post.title}</strong><p>{format!=='text'&&(post.caption||'문구 없음')}</p><span className="post-meta">{FORMAT_LABELS[format]} · {CHANNEL_LABELS[post.channel]} · <time dateTime={post.updatedAt}>{date(post.updatedAt)}</time></span></div>
    </a>
    <div className="post-actions">{actions}</div>
  </article>;
}
function PostList({posts,projects,project,act,busy}:{posts:Post[];projects:Project[];project:Project;act:Act;busy:boolean}) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [channel,setChannel]=useState('all');
  const [connections,setConnections]=useState<ConnectionLite[]>([]);
  useEffect(()=>{api<ConnectionLite[]>(`projects/${project.slug}/channels`).then(setConnections).catch(()=>setConnections([]));},[project.slug,posts.length]);
  const visible=posts.filter(p=>(status==='all'||p.status===status)&&(channel==='all'||p.channel===channel)&&`${p.title} ${p.caption}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="content-toolbar"><div className="status-filters" aria-label="콘텐츠 상태">{[['all','전체'],['draft','초안'],['review','검토 대기'],['approved','검토 완료']].map(([s,label])=><button className={s===status?'selected':''} key={s} onClick={()=>setStatus(s)} aria-pressed={s===status}>{label}<span>{s==='all'?posts.length:posts.filter(p=>p.status===s).length}</span></button>)}</div>
      <div className="toolbar-right"><div className="status-filters channel-filters" aria-label="채널">{[['all','모든 채널'],['instagram','Instagram'],['threads','Threads'],['x','X']].map(([c,label])=><button className={c===channel?'selected':''} key={c} onClick={()=>setChannel(c)} aria-pressed={c===channel}>{label}</button>)}</div><label className="search-field"><Search size={16}/><input aria-label="콘텐츠 검색" placeholder="콘텐츠 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label></div></div>
    {!project.profileReviewedAt&&<div className="inline-note"><CircleHelp size={17}/><span>제품 정보를 확인하면 콘텐츠 검토를 완료할 수 있어요.</span><a href={settingsPath(project,'brand')}>정보 확인<ChevronRight size={15}/></a></div>}
    {visible.length?<div className="post-grid">{visible.map(post=><PostCard key={post.id} post={post} project={project} connection={connections.find(c=>c.channel===post.channel)} act={act} busy={busy}/>)}</div>:<section className="panel"><Empty title={query||status!=='all'||channel!=='all'?'조건에 맞는 콘텐츠가 없어요.':'첫 이야기를 만들어 볼까요?'}><p>{query||status!=='all'||channel!=='all'?'검색어나 필터를 바꿔 보세요.':`${project.name}의 기능이나 활용 장면을 짧은 글로 시작해 보세요.`}</p>{!query&&status==='all'&&channel==='all'&&<a className="button" href={`${projectPath(project)}/new`}><Plus size={16}/>첫 콘텐츠 작성</a>}</Empty></section>}
  </>;
}

type Mutate=<T>(path:string,body:unknown,method?:string)=>Promise<T>;
function Editor({project,post,busy,dirty,setDirty,mutate,notify}:{project:Project;post?:Post;busy:boolean;dirty:boolean;setDirty:(v:boolean)=>void;mutate:Mutate;notify:(v:string)=>void}) {
  const [form,setForm]=useState<PostInput>({title:post?.title||'',caption:post?.caption||'',brief:post?.brief||'',channel:post?.channel||'x',language:post?.language||'ko'});
  const [imageName,setImageName]=useState(''), [imageError,setImageError]=useState(''), [reading,setReading]=useState(false);
  const [confirmingDelete,setConfirmingDelete]=useState(false), [deleting,setDeleting]=useState(false);
  const reader=useRef<FileReader|null>(null), imageInput=useRef<HTMLInputElement|null>(null);
  useEffect(()=>()=>{if(reader.current){reader.current.onload=null;reader.current.onerror=null;reader.current.abort();}},[]);
  function chooseImage(file?:File) {
    if(!file)return;
    setImageError('');
    const video=file.type==='video/mp4';
    if(!['image/png','image/jpeg','video/mp4'].includes(file.type)||file.size>(video?MAX_POST_VIDEO_BYTES:MAX_POST_IMAGE_BYTES)||!file.size){
      setImageError('5 MB 이하의 PNG·JPEG 이미지 또는 15 MB 이하의 MP4 영상을 선택해 주세요.');
      if(imageInput.current)imageInput.current.value='';
      return;
    }
    setReading(true);setDirty(true);
    const next=new FileReader();reader.current=next;
    next.onload=()=>{const data=String(next.result);if(video){void capturePoster(data).then(poster=>{setForm(p=>({...p,image:data,...(poster?{poster}:{})}));setImageName(file.name);setReading(false);});}else{setForm(p=>{const {poster:_,...rest}=p;return {...rest,image:data};});setImageName(file.name);setReading(false);}};
    next.onerror=()=>{setImageError('이미지를 읽지 못했어요. 다시 선택해 주세요.');setReading(false);};
    next.readAsDataURL(file);
  }
  const update=(key:keyof PostInput,value:string)=>{setForm(p=>({...p,[key]:value}));setDirty(true);};
  async function save(event:FormEvent) {event.preventDefault();if(busy||reading)return;try{const result=await mutate<Post>(`projects/${project.slug}/posts${post?`/${post.id}`:''}`,{...form,...(post?{revision:post.revision}:{})},post?'PATCH':'POST');if(!post)window.location.assign(`${projectPath(project)}/${result.id}`);}catch{}}
  async function action(action:string) {if(!post)return;try{await mutate(`projects/${project.slug}/posts/${post.id}/${action}`,{revision:post.revision});}catch{}}
  async function remove() {
    if(!post||deleting)return;
    setDeleting(true);
    try{await api(`projects/${project.slug}/posts/${post.id}/delete`,{revision:post.revision});setDirty(false);window.location.assign(projectPath(project));}
    catch(e){notify(e instanceof Error?e.message:'삭제하지 못했어요.');setConfirmingDelete(false);setDeleting(false);}
  }
  return <>
    <a className="back-link" href={projectPath(project)}><ArrowLeft size={15}/>콘텐츠 목록</a>
    <div className="editor-grid">
      <form className="panel editor-form" onSubmit={save}>
        <div className="section-title"><h2>{post?'콘텐츠 편집':'새 콘텐츠'}</h2>{post?<Badge status={post.status}/>:<span className="muted">아직 저장되지 않았어요</span>}</div>
        <fieldset className="editor-fields" disabled={busy||reading}>
          <label>제목<input autoFocus={!post} required maxLength={120} value={form.title} onChange={e=>update('title',e.target.value)} placeholder="이 콘텐츠를 알아볼 수 있는 제목"/></label>
          <div className="field-pair"><label>채널<select value={form.channel} onChange={e=>update('channel',e.target.value)}>{Object.entries(CHANNEL_LABELS).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>언어<select value={form.language} onChange={e=>update('language',e.target.value)}><option value="ko">한국어</option><option value="en">English</option></select></label></div>
          <label>이야기할 내용<span className="field-hint">소개할 기능이나 전달할 메시지</span><input value={form.brief} maxLength={1200} onChange={e=>update('brief',e.target.value)} placeholder="예: 짧은 통화로 하루의 이야기를 꺼내기"/></label>
          <label>게시 문구<textarea rows={10} maxLength={5000} value={form.caption} onChange={e=>update('caption',e.target.value)} placeholder="독자에게 전하고 싶은 이야기를 작성해 주세요."/></label>
          <div className="caption-tools"><span>{Array.from(form.caption).length}자</span><button type="button" className="text-button" disabled={!form.caption} onClick={()=>{void navigator.clipboard.writeText(form.caption).then(()=>notify('문구를 복사했어요.')).catch(()=>notify('복사하지 못했어요. 본문을 선택해 복사해 주세요.'));}}><Copy size={14}/>문구 복사</button></div>
          <label>{post?.assetId?'미디어 교체':'미디어 첨부'}<span className="field-hint">PNG · JPEG 최대 5 MB / MP4 최대 15 MB (영상 게시는 Instagram만)</span><input ref={imageInput} type="file" accept="image/png,image/jpeg,video/mp4" onChange={e=>chooseImage(e.target.files?.[0])}/></label>
          {(form.image?.startsWith('data:video/')||(!form.image&&post?.format==='video'))&&<label>썸네일 이미지<span className="field-hint">선택 · PNG·JPEG 최대 1 MB · 피드와 미리보기의 첫 화면으로 쓰여요{form.poster?' · 선택됨':post?.posterAssetId?' · 등록됨':''}</span><input type="file" accept="image/png,image/jpeg" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/png','image/jpeg'].includes(f.type)||f.size>1024*1024){setImageError('1 MB 이하의 PNG 또는 JPEG 썸네일을 선택해 주세요.');return;}const fr=new FileReader();fr.onload=()=>{setForm(p=>({...p,poster:String(fr.result)}));setDirty(true);};fr.readAsDataURL(f);}}/></label>}
          {form.image&&<div className="upload-selection"><span>{imageName}</span><button type="button" className="text-button" onClick={()=>{setForm(({image,poster,...rest})=>rest);setImageName('');if(imageInput.current)imageInput.current.value='';}}>선택 취소</button></div>}
        </fieldset>
        {imageError&&<p className="error" role="alert">{imageError}</p>}
        <div className="editor-actions"><span className="muted">{reading?'이미지를 읽는 중…':dirty?'저장하지 않은 변경이 있어요.':post?'모든 변경사항이 저장됐어요.':'초안으로 저장돼요.'}</span><button className="button primary" type="submit" disabled={busy||reading||(!dirty&&!!post)}>{busy?'저장 중…':'초안 저장'}</button></div>
      </form>
      <aside className="editor-aside">
        <section className={`panel preview-panel post-preview ${form.channel}`}><div className="preview-head"><p className="eyebrow">PREVIEW · {CHANNEL_LABELS[form.channel]}</p>{post?.assetId&&!form.image&&<a className="text-button" href={`/api/assets/${post.assetId}`} target="_blank" rel="noreferrer">원본 열기<ArrowUpRight size={13}/></a>}</div>
          <div className="phone-post"><div className="phone-post-head"><Mark project={project}/><div><strong>{project.name}</strong><span>{form.channel==='instagram'?'Instagram · 피드':form.channel==='threads'?'Threads':'X'}</span></div></div>
            {form.image?.startsWith('data:video/')?<video className="phone-post-media" controls preload="metadata" poster={form.poster} src={form.image}/>:(form.image||(post?.format==='image'&&post.assetId))?<img className="phone-post-media" src={form.image||`/api/assets/${post!.assetId}`} alt="첨부 이미지 미리보기"/>:post?.format==='video'&&post.assetId?<video className="phone-post-media" controls preload="metadata" poster={post.posterAssetId?`/api/assets/${post.posterAssetId}?w=720`:undefined} src={`/api/assets/${post.assetId}`}/>:form.channel==='instagram'?<div className="phone-post-media placeholder"><FileText size={22}/><span>Instagram 발행에는 이미지나 영상이 필요해요.</span></div>:null}
            <p className={`phone-post-caption ${!form.caption?'muted':''}`}>{form.channel==='instagram'&&form.caption&&<strong>{project.name.toLowerCase()} </strong>}{form.caption||'작성한 문구가 여기에 표시돼요.'}</p>
          </div>
          {(form.image?.startsWith('data:video/')||(!form.image&&post?.format==='video'))&&form.channel!=='instagram'&&<div className="preview-media"><FileText size={22}/><span>영상 직접 게시는 Instagram만 지원해요. 다른 채널은 원본을 내려받아 게시해 주세요.</span></div>}
        </section>
        <section className="panel review-panel"><div className="section-title"><h3>콘텐츠 검토</h3><ShieldCheck size={18}/></div><p>{project.profileReviewedAt?'제품 정보가 확인되어 있어요. 이미지와 문구를 검토한 뒤 완료해 주세요.':'브랜드 설정의 기능과 설명을 먼저 확인해 주세요.'}</p><a className="text-button" href={settingsPath(project,'brand')}>브랜드 설정 확인<ArrowUpRight size={14}/></a><div className="review-actions">{!post?<p className="muted">초안을 저장하면 검토를 시작할 수 있어요.</p>:post.status==='draft'?<button className="button" disabled={busy||reading||dirty||!form.caption.trim()} onClick={()=>void action('review')}>검토 대기로 보내기</button>:post.status==='review'?<button className="button primary" disabled={busy||reading||dirty||!project.profileReviewedAt} onClick={()=>void action('approve')}><Check size={16}/>콘텐츠 검토 완료</button>:<><p className="ready-label"><Check size={15}/>콘텐츠 검토가 완료됐어요.</p><button className="button" disabled={busy||reading||dirty} onClick={()=>void action('reopen')}>초안으로 되돌리기</button></>}</div></section>
        <div className="publishing-note"><SlidersHorizontal size={17}/><p>문구와 미디어를 검토한 후 아래에서 게시할 계정을 확인해 주세요. 자동·예약 게시는 실행하지 않아요.</p></div>
        {post&&!post.publishStatus&&<section className="panel danger-panel" aria-label="콘텐츠 삭제">{confirmingDelete?<><p><strong>{post.title}</strong>을(를) 삭제할까요? 첨부한 이미지도 함께 지워지고 되돌릴 수 없어요.</p><div className="danger-actions"><button type="button" className="button danger" disabled={deleting} onClick={()=>void remove()}><Trash2 size={15}/>{deleting?'삭제 중…':'삭제 확정'}</button><button type="button" className="button" disabled={deleting} onClick={()=>setConfirmingDelete(false)}>취소</button></div></>:<><p className="muted">게시 요청 전의 콘텐츠만 삭제할 수 있어요. 삭제 기록은 최근 작업에 남아요.</p><button type="button" className="text-button danger-text" disabled={busy||reading} onClick={()=>setConfirmingDelete(true)}><Trash2 size={14}/>이 콘텐츠 삭제</button></>}</section>}
      </aside>
    </div>
  </>;
}

/** Grab a first-frame JPEG from a video data URL in the browser so feeds can show a poster without server-side video tools. */
function capturePoster(src:string):Promise<string|undefined> {
  return new Promise(resolve=>{
    const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=src;
    const done=(poster?:string)=>{v.removeAttribute('src');v.load();resolve(poster);};
    const timer=setTimeout(()=>done(),8000);
    v.onerror=()=>{clearTimeout(timer);done();};
    v.onloadeddata=()=>{try{v.currentTime=Math.min(0.2,(v.duration||1)/2);}catch{clearTimeout(timer);done();}};
    v.onseeked=()=>{clearTimeout(timer);try{const scale=Math.min(1,720/(v.videoWidth||720));const c=document.createElement('canvas');c.width=Math.round((v.videoWidth||720)*scale);c.height=Math.round((v.videoHeight||1280)*scale);c.getContext('2d')!.drawImage(v,0,0,c.width,c.height);done(c.toDataURL('image/jpeg',0.85));}catch{done();}};
  });
}
function ProductSettings({project,initialSection,children}:{project:Project;initialSection?:'brand'|'channels';children:React.ReactNode}) {
  const sections:[string,string,string][]=[['brand','브랜드','제품 설명, 고객, 말투처럼 콘텐츠의 기준이 되는 정보'],['channels','채널','이 제품의 SNS 계정 연결과 게시 경로']];
  useEffect(()=>{
    const target=initialSection || (window.location.hash.replace('#','') as 'brand'|'channels'|'');
    if (!target) return;
    if (initialSection) window.history.replaceState(null,'',settingsPath(project,initialSection));
    document.getElementById(target)?.scrollIntoView({block:'start'});
  },[project,initialSection]);
  return <div className="product-settings">
    <nav className="settings-nav" aria-label="설정 섹션">{sections.map(([id,label,description])=><a key={id} href={`#${id}`}><strong>{label}</strong><span>{description}</span></a>)}</nav>
    <section id="brand" className="settings-section" aria-labelledby="settings-brand-title"><div className="settings-section-title"><h2 id="settings-brand-title">브랜드</h2><p className="muted">저장하면 새 버전이 만들어지고, 바뀐 정보로 기존 콘텐츠를 다시 검토하게 돼요.</p></div>{children}</section>
    <section id="channels" className="settings-section" aria-labelledby="settings-channels-title"><div className="settings-section-title"><h2 id="settings-channels-title">채널</h2></div><ProductChannels project={project}/></section>
  </div>;
}

function BrandReference({project}:{project:Project}) {
  const brand=productBrands[project.slug];
  if (!brand) return null;
  return <section className="panel brand-reference" aria-label={`${project.name} 브랜드 원본`}><Mark project={project} large/><h3>{project.name}</h3><p className="muted">{brand.category}</p><dl><dt>프로젝트 위치</dt><dd>{brand.repository}</dd><dt>로고 원본</dt><dd>{brand.source}</dd><dt>기본 정보 분석</dt><dd>2026. 09. 25 · 저장소 기준<br/>고객·말투는 초기 가설, 기능은 근거를 함께 기록했어요. 출시·운영 상태는 별도 확인이 필요해요.</dd></dl></section>;
}

function Profile({project,busy,dirty,setDirty,mutate}:{project:Project;busy:boolean;dirty:boolean;setDirty:(v:boolean)=>void;mutate:Mutate}) {
  const [form,setForm]=useState<ProfileInput>({revision:project.revision,description:project.description,audience:project.audience,facts:project.facts,tone:project.tone,avoid:project.avoid,website:project.website});
  const fields:[keyof Omit<ProfileInput,'revision'>,string,string][]=[['description','한 줄 설명','이 제품은 무엇을 하는 서비스인가요?'],['audience','주요 고객','누구에게 전하고 싶은가요?'],['facts','확인된 기능과 근거','현재 제공하는 기능과 확인한 자료를 함께 적어 주세요.'],['tone','브랜드 말투','어떤 목소리로 이야기할까요?'],['avoid','피해야 할 표현','미확인 기능이나 보장할 수 없는 효과 등'],['website','공식 소개 링크','https://']];
  return <div className="profile-grid"><form className="panel editor-form" onSubmit={e=>{e.preventDefault();void mutate(`projects/${project.slug}/profile`,form,'PATCH').catch(()=>{});}}><div className="section-title"><h2>브랜드 정보</h2><span className="muted">버전 {project.revision}</span></div>{fields.map(([key,label,hint])=><label key={key}>{label}{key!=='website'?<textarea required={key==='description'} rows={key==='facts'?10:key==='description'?2:3} maxLength={key==='facts'?5000:key==='avoid'?2000:1000} value={String(form[key])} placeholder={hint} onChange={e=>{setForm(f=>({...f,[key]:e.target.value}));setDirty(true);}}/>:<input type="url" maxLength={1000} value={String(form[key])} placeholder={hint} onChange={e=>{setForm(f=>({...f,[key]:e.target.value}));setDirty(true);}}/>}</label>)}<div className="editor-actions"><span className="muted">저장하면 새 버전이 만들어져요.</span><button className="button primary" disabled={busy||!dirty}>변경사항 저장</button></div></form><aside><BrandReference project={project}/><section className="panel review-panel"><ShieldCheck size={22}/><h3>콘텐츠의 기준이 되는 정보</h3><p>기능·가격·출시 상태는 실제 제공 여부를 확인하고 적어 주세요. 정보가 바뀌면 기존 콘텐츠를 다시 검토하게 돼요.</p>{project.profileReviewedAt?<p className="ready-label"><Check size={15}/>현재 버전 확인 완료</p>:<><p className="muted">초기 정보는 저장소를 참고한 초안이에요.</p><button className="button" disabled={busy||dirty||!form.facts.trim()} onClick={()=>void mutate(`projects/${project.slug}/profile/review`,{revision:project.revision}).catch(()=>{})}>현재 정보 확인 완료</button></>}</section></aside></div>;
}
