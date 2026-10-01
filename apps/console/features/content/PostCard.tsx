'use client';
import { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { CHANNEL_LABELS, type Post, type Project } from '@nullge/contracts';
import { Badge } from '../../components/ui/Badge';
import { ChannelMark } from '../../components/ui/ChannelMark';
import { Mark } from '../../components/ui/Mark';
import { type Act, type ConnectionLite } from './types';
import { date, projectPath, settingsPath } from '../../lib/api';

export const FORMAT_LABELS:Record<string,string>={text:'글',image:'이미지',video:'영상'};

export function PostCard({post,project,connection,act,busy}:{post:Post;project:Project;connection?:ConnectionLite;act:Act;busy:boolean}) {
  const [confirming,setConfirming]=useState(false);
  const format=post.format||'text';
  const media=format==='image'&&post.assetId?<img src={`/api/assets/${post.assetId}?w=480`} alt="" loading="lazy"/>
    :format==='video'&&post.assetId?<>{post.posterAssetId?<img src={`/api/assets/${post.posterAssetId}?w=480`} alt="" loading="lazy"/>:<video src={`/api/assets/${post.assetId}#t=0.2`} muted playsInline preload="auto"/>}<span className="play-badge" aria-hidden="true">▶</span></>
    :<div className={`text-card ${post.channel}`}><div className="text-card-head"><Mark project={project}/><strong>{project.name}</strong></div><p>{post.caption||'본문을 작성해 주세요.'}</p></div>;
  const base=`projects/${project.slug}/posts/${post.id}`;
  const publishState=post.publishStatus?({queued:'게시 대기',creating:'게시 준비',processing:'게시 중',submitting:'게시 중',published:'게시됨',failed:'게시 실패',uncertain:'확인 필요'} as Record<string,string>)[post.publishStatus]:null;
  const actions=post.publishStatus?(post.publishedUrl?<a className="text-button" href={post.publishedUrl} target="_blank" rel="noreferrer">게시물 열기<ArrowUpRight size={13}/></a>:<span className="muted">{publishState}</span>)
    :post.status==='draft'?<button className="button small primary" disabled={busy||!post.caption.trim()||!project.profileReviewedAt} title={project.profileReviewedAt?undefined:'브랜드 설정을 먼저 확인해 주세요.'} onClick={()=>void act(`${base}/approve`,{revision:post.revision},'승인했어요. 이제 게시할 수 있어요.')}><Check size={14}/>승인</button>
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
