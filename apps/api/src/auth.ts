import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { Request, Response } from 'express';
import { database, WORKSPACE_ID } from '@nullge/database';

export const SESSION_COOKIE = 'nullge_console_session';
const OAUTH_COOKIE = 'nullge_console_oauth';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const random = () => randomBytes(32).toString('base64url');
export const origin = () => process.env.CONSOLE_ORIGIN || 'http://127.0.0.1:4310';
export const localMode = () => process.env.NODE_ENV !== 'production' && process.env.CONSOLE_DEV_LOGIN === '1' && ['127.0.0.1','localhost'].includes(new URL(origin()).hostname);
const googleReady = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OWNER_EMAIL);
export function cookie(request: Request, name: string) {
  return (request.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1) || '';
}
function setCookie(response: Response, name: string, value: string, maxAge: number) {
  response.cookie(name,value,{ httpOnly:true,secure:origin().startsWith('https:'),sameSite:'lax',path:'/',maxAge });
}
export interface Identity { id: string; email: string; name: string; workspaceId: string; }
export interface AuthenticatedRequest extends Request { operator: Identity; }

@Injectable()
export class AuthService {
  constructor(@Inject('DB') readonly db: ReturnType<typeof database>) {}
  options() { return { local:localMode(), google:googleReady() }; }
  async identity(request: Request): Promise<Identity> {
    const token = cookie(request,SESSION_COOKIE);
    if (!/^[\w-]{43}$/.test(token)) throw new UnauthorizedException('로그인이 필요합니다.');
    const [user] = await this.db.query(`SELECT o.id,o.email,o.name,m."workspaceId",o."isLocal" FROM sessions s JOIN operators o ON o.id=s."operatorId" JOIN memberships m ON m."operatorId"=o.id WHERE s.hash=$1 AND s."expiresAt">now() AND m."workspaceId"=$2`, [digest(token),WORKSPACE_ID]);
    if (!user || (user.isLocal && !localMode())) throw new UnauthorizedException('로그인이 만료되었습니다.');
    return { id:user.id,email:user.email,name:user.name,workspaceId:user.workspaceId };
  }
  private async session(operatorId: string, response: Response) {
    const token = random();
    await this.db.query('DELETE FROM sessions WHERE "expiresAt"<now()');
    await this.db.query(`INSERT INTO sessions (hash,"operatorId","expiresAt") VALUES ($1,$2,now()+interval '8 hours')`, [digest(token),operatorId]);
    setCookie(response,SESSION_COOKIE,token,8*3600_000);
  }
  async local(request: Request, response: Response) {
    if (!localMode() || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress || '')) throw new ForbiddenException('로컬 환경에서만 사용할 수 있습니다.');
    const id = '6ea85a94-bb57-48b7-87f0-24e16334489d';
    await this.db.transaction(async manager => {
      await manager.query(`INSERT INTO operators (id,email,name,"isLocal") VALUES ($1,'local@nullge.invalid','Nullge 운영자',true) ON CONFLICT (id) DO NOTHING`, [id]);
      await manager.query(`INSERT INTO memberships ("workspaceId","operatorId",role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,[WORKSPACE_ID,id]);
    });
    await this.session(id,response);
    return { ok:true };
  }
  async logout(request: Request, response: Response) {
    await this.db.query('DELETE FROM sessions WHERE hash=$1',[digest(cookie(request,SESSION_COOKIE))]);
    setCookie(response,SESSION_COOKIE,'',0);
    return { ok:true };
  }
  private client() {
    if (!googleReady()) throw new ForbiddenException('운영자 Google 로그인이 아직 설정되지 않았습니다.');
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,`${origin()}/api/auth/google/callback`);
  }
  async google(response: Response) {
    const client = this.client();
    const state = random(), browser = random(), nonce = random(), verifier = random();
    await this.db.query('DELETE FROM oauth_attempts WHERE "expiresAt"<now()');
    await this.db.query(`INSERT INTO oauth_attempts ("stateHash","browserHash",nonce,verifier,"expiresAt") VALUES ($1,$2,$3,$4,now()+interval '10 minutes')`,[digest(state),digest(browser),nonce,verifier]);
    setCookie(response,OAUTH_COOKIE,browser,600_000);
    const url = new URL(client.generateAuthUrl({ scope:['openid','email','profile'],state,prompt:'select_account' }));
    url.searchParams.set('nonce',nonce);
    url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method','S256');
    response.redirect(url.toString());
  }
  async callback(request: Request, response: Response) {
    const state = typeof request.query.state==='string' ? request.query.state : '';
    const code = typeof request.query.code==='string' ? request.query.code : '';
    const browser = cookie(request,OAUTH_COOKIE);
    setCookie(response,OAUTH_COOKIE,'',0);
    if (!state || !code || !browser) return response.redirect(`${origin()}/login?error=google`);
    const [attempt] = await this.db.query(`WITH claimed AS (DELETE FROM oauth_attempts WHERE "stateHash"=$1 AND "browserHash"=$2 AND "expiresAt">now() RETURNING *) SELECT * FROM claimed`,[digest(state),digest(browser)]);
    if (!attempt) return response.redirect(`${origin()}/login?error=google`);
    try {
      const client = this.client();
      const { tokens } = await client.getToken({ code,codeVerifier:attempt.verifier });
      if (!tokens.id_token) throw new Error('Missing identity');
      const ticket = await client.verifyIdToken({ idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload() as (ReturnType<typeof ticket.getPayload> & { nonce?: string });
      if (!payload?.sub || !payload.email_verified || payload.nonce!==attempt.nonce || payload.email?.toLowerCase()!==process.env.OWNER_EMAIL?.toLowerCase()) throw new Error('Owner identity mismatch');
      const operatorId = await this.db.transaction(async manager => {
        await manager.query(`SELECT pg_advisory_xact_lock(81623017)`);
        const [existing] = await manager.query('SELECT * FROM operators WHERE email=$1',[payload.email!.toLowerCase()]);
        if (existing && (existing.googleSub!==payload.sub || existing.isLocal)) throw new Error('Owner subject mismatch');
        const id = existing?.id || randomUUID();
        if (!existing) await manager.query('INSERT INTO operators (id,"googleSub",email,name) VALUES ($1,$2,$3,$4)',[id,payload.sub,payload.email!.toLowerCase(),payload.name || 'Nullge 운영자']);
        await manager.query(`INSERT INTO memberships ("workspaceId","operatorId",role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,[WORKSPACE_ID,id]);
        return id;
      });
      await this.session(operatorId,response);
      return response.redirect(`${origin()}/`);
    } catch { return response.redirect(`${origin()}/login?error=google`); }
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.operator = await this.auth.identity(request);
    return true;
  }
}
