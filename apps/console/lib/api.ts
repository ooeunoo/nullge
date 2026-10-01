import { type Project } from '@nullge/contracts';

export class ApiError extends Error { constructor(message: string,readonly status: number) { super(message); } }

export async function api<T>(path: string,body?: unknown,method='POST'): Promise<T> {
  const response=await fetch(`/api/${path}`,{ method:body===undefined?'GET':method,cache:'no-store',headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body) });
  const data=await response.json();
  if (!response.ok) throw new ApiError(data.message || '요청을 처리하지 못했습니다.',response.status);
  return data as T;
}

export const projectPath=(project: Project,tab='marketing')=>`/projects/${project.slug}/${tab}`;

export const settingsPath=(project: Project,section?: 'brand'|'channels')=>`${projectPath(project,'settings')}${section?`#${section}`:''}`;

export const date=(value: string)=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));
