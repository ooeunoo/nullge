import type { NextRequest } from 'next/server';
import { POST_BODY_LIMIT } from '@nullge/contracts';
export const dynamic = 'force-dynamic';
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/');
  const allowed = request.method==='GET' ? /^(dashboard|settings\/(integrations|buffer\/channels)|channels\/(x|threads|instagram)\/callback|(public-assets|assets)\/[a-f0-9-]{36}|projects\/[a-z0-9-]+\/(channels|generations)|auth\/(options|google|google\/callback))$/.test(route)
    : request.method==='PATCH' ? /^(settings\/integrations|projects\/[a-z0-9-]+\/(profile|posts\/[a-f0-9-]{36}))$/.test(route)
    : /^(settings\/integrations\/verify|auth\/(local|logout)|projects\/[a-z0-9-]+\/(channels\/(x|threads|instagram)\/(connect|disconnect|verify|authorize|buffer)|generations\/(quote|confirm)|posts|profile\/review|posts\/[a-f0-9-]{36}\/(review|approve|reopen|publish)))$/.test(route);
  const headers = new Headers({ 'Cache-Control':'private, no-store' });
  const fail = (message: string,status: number) => Response.json({ message },{ status,headers });
  if (!allowed) return fail('요청 경로를 찾을 수 없습니다.',404);
  const configuredOrigin = process.env.CONSOLE_ORIGIN || (process.env.NODE_ENV!=='production' ? 'http://127.0.0.1:4310' : '');
  if (!configuredOrigin) return fail('운영 주소가 설정되지 않았습니다.',503);
  if (request.method!=='GET' && request.headers.get('origin')!==configuredOrigin) return fail('요청 출처를 확인할 수 없습니다.',403);
  try {
    let body: string | undefined;
    if (request.method!=='GET') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('JSON 입력이 필요합니다.',415);
      const reader = request.body?.getReader();
      const chunks: Uint8Array[]=[];
      let size=0;
      const limit=/^projects\/[a-z0-9-]+\/posts(?:\/[a-f0-9-]{36})?$/.test(route)
        ? POST_BODY_LIMIT : route.endsWith('/generations/quote')?3*1024*1024:24*1024;
      if (reader) for (;;) { const { done,value }=await reader.read(); if (done) break; size+=value.length; if (size>limit) { await reader.cancel(); return fail('입력이 너무 큽니다.',413); } chunks.push(value); }
      body=Buffer.concat(chunks).toString('utf8');
    }
    const upstream = await fetch(`${process.env.API_INTERNAL_URL || 'http://127.0.0.1:4311'}/${route}${request.nextUrl.search}`,{
      method:request.method,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(110_000),
      headers:{ cookie:request.headers.get('cookie') || '',origin:configuredOrigin,...(body!==undefined ? { 'content-type':'application/json' } : {}) },body,
    });
    headers.set('X-Content-Type-Options','nosniff');
    for (const key of ['content-type','location','content-length','content-disposition','referrer-policy']) { const value=upstream.headers.get(key); if (value) headers.set(key,value); }
    for (const value of upstream.headers.getSetCookie()) headers.append('set-cookie',value);
    return new Response(upstream.body,{ status:upstream.status,headers });
  } catch { return fail('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',503); }
}
export { proxy as GET,proxy as POST,proxy as PATCH };
