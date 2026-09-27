// Run after pnpm build. Uses a disposable local PostgreSQL database and loopback servers.
// Fake OAuth application IDs only; never follows authorization URLs or calls SNS/providers.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { database, seedDevelopment } from '../packages/database/dist/index.js';
const name=`nullge_test_${randomUUID().replaceAll('-','')}`;
const admin=await database('postgres://nullge@127.0.0.1:5549/postgres').initialize();
const url=`postgres://nullge@127.0.0.1:5549/${name}`;
let db,api,consoleServer;
const base='http://127.0.0.1:4316';
const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',CONSOLE_DEV_LOGIN:'1',CONSOLE_ORIGIN:base,DATABASE_URL:url,API_PORT:'4317',API_INTERNAL_URL:'http://127.0.0.1:4317',MARKETING_SECRET_KEY:'ab'.repeat(32)};
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const wait=async(path)=>{for(let i=0;i<50;i++){try{const r=await fetch(path);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Server startup timeout')};
try{
 await admin.query(`CREATE DATABASE "${name}"`);
 db=await database(url).initialize();await db.runMigrations();await seedDevelopment(db);
 api=spawn(process.execPath,['apps/api/dist/main.js'],{env,stdio:'ignore'});
 consoleServer=spawn(process.execPath,['apps/console/node_modules/next/dist/bin/next','start','apps/console','--hostname','127.0.0.1','--port','4316'],{env,stdio:'ignore'});
 await wait(`${base}/api/auth/options`);
 const anonymous=await fetch(`${base}/api/channels/instagram/callback?state=invalid&code=invalid`,{redirect:'manual'});check(anonymous.status===401,'callback must require owner session');
 const login=await fetch(`${base}/api/auth/local`,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'});
 check(login.ok,'local fixture login');const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const request=async(path,body,method='POST',source=base)=>fetch(`${base}/api/${path}`,{method,redirect:'manual',headers:{cookie,origin:source,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const settings=await (await request('settings/integrations',undefined,'GET')).json();
 const {configured,encryptionReady,updatedAt,...input}=settings;
 check((await request('settings/integrations',{...input,secrets:{instagramClientId:'test-ig',instagramClientSecret:'test-ig-secret',threadsClientId:'test-th',threadsClientSecret:'test-th-secret',xClientId:'test-x',xClientSecret:'test-x-secret'},clear:[]},'PATCH')).ok,'save test app credentials');
 for(const channel of ['x','instagram','threads']){
  const denied=await request(`projects/mellow/channels/${channel}/authorize`,{revision:0},'POST','https://evil.invalid');check(denied.status===403,`${channel} origin protection`);
  const start=await request(`projects/mellow/channels/${channel}/authorize`,{revision:0});check(start.ok,`${channel} start route`);
  const u=new URL((await start.json()).url);check(u.searchParams.get('redirect_uri')===`${base}/api/channels/${channel}/callback`,`${channel} callback value`);
  const cancel=await request(`channels/${channel}/callback?state=${u.searchParams.get('state')}&error=access_denied`,undefined,'GET');
  check(cancel.status===302&&cancel.headers.get('location')===`${base}/projects/mellow/channels?connection_error=${channel}`,`${channel} cancel route`);
  check(cancel.headers.get('referrer-policy')==='no-referrer',`${channel} referrer protection`);
 }
 check((await request('channels/facebook/callback',undefined,'GET')).status===404,'unlisted callback rejection');
 const [counts]=await db.query('SELECT (SELECT count(*) FROM posts)::int posts,(SELECT count(*) FROM generation_jobs)::int generations,(SELECT count(*) FROM publication_jobs)::int publications');
 check(Object.values(counts).every(v=>v===0),'no content or provider jobs');
 console.log('PASS: real API + Next proxy, all three OAuth starts/cancellation callbacks, anonymous 401, origin 403, unknown callback 404, no-referrer, no jobs.');
}finally{
 for(const child of [api,consoleServer])if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
 if(db?.isInitialized)await db.destroy();await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.destroy();
}
