// Explicitly authorized migration. No credentials are printed, written to disk, or passed in argv.
// Requires an already registered, operator-approved Railway SSH identity.
import {spawnSync} from 'node:child_process';
const identity=process.argv[2];
if(!identity)throw Error('Pass the temporary SSH identity path.');
const sourceProject='f71b2ffa-10db-488b-af94-fe13e9c0c216',targetProject='3c584db8-6a84-4244-851d-0a4911e42674';
const read=`
const {DataSource}=require(require.resolve('typeorm',{paths:['/app/packages/core']}));
const {createDecipheriv}=require('node:crypto');
(async()=>{
 const db=await new DataSource({type:'postgres',url:process.env.DATABASE_URL,logging:false}).initialize();
 try{
  const [s]=await db.query('SELECT * FROM marketing_settings WHERE id=1');
  if(!s?.credentials)throw Error();
  if(s.mode!=='off'||s.publishingEnabled||s.threadsPublishingEnabled||s.xPublishingEnabled)throw Error('Legacy automation must be reviewed before migration.');
  const [version,iv,tag,bytes]=s.credentials.split('.');if(version!=='v1')throw Error();
  const d=createDecipheriv('aes-256-gcm',Buffer.from(process.env.MARKETING_SECRET_KEY,'hex'),Buffer.from(iv,'base64'));
  d.setAAD(Buffer.from('mellow-marketing-v1'));d.setAuthTag(Buffer.from(tag,'base64'));
  const c=JSON.parse(Buffer.concat([d.update(Buffer.from(bytes,'base64')),d.final()]).toString());
  const shared=Object.fromEntries(['higgsfieldKey','higgsfieldSecret','xClientId','xClientSecret'].filter(k=>c[k]).map(k=>[k,c[k]]));
  const channels=[];
  for(const channel of ['x','threads','instagram']){
   const token=c[channel==='x'?'xAccessToken':channel+'Token'];
   if(token&&s[channel+'UserId']&&s[channel+'VerifiedAt'])channels.push({channel,token,userId:s[channel+'UserId'],username:s[channel+'Username'],verifiedAt:s[channel+'VerifiedAt'],...(channel==='x'?{refreshToken:c.xRefreshToken,expiresAt:c.xTokenExpiresAt}:{})});
  }
  process.stdout.write(JSON.stringify({revision:s.revision,shared,channels}));
 }finally{await db.destroy();}
})().catch(()=>{console.error('Source marketing read failed; details withheld.');process.exitCode=1;});`;
const write=`
const {randomUUID}=require('node:crypto');
const {database,MarketingStore,seal,unseal,WORKSPACE_ID:w}=require('/app/packages/database/dist/index.js');
let raw='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>{raw+=d;if(raw.length>65536)process.exit(1);});
process.stdin.on('end',()=>void (async()=>{
 const input=JSON.parse(raw),db=await database().initialize(),store=new MarketingStore(db);
 try{
  const result=await db.transaction(async m=>{
   const settings=await store.settingsRow(w,m,true),marker='mellow_settings_import:'+input.revision;
   const [previous]=await m.query('SELECT id FROM integration_events WHERE "workspaceId"=$1 AND action=$2',[w,marker]);
   if(previous)return {alreadyImported:true};
   if(await store.hasActive(w,m))throw Error('Active jobs');
   const [project]=await m.query('SELECT * FROM projects WHERE "workspaceId"=$1 AND slug=$2 FOR UPDATE',[w,'mellow']);
   const [owner]=await m.query('SELECT o.id FROM operators o JOIN memberships m ON m."operatorId"=o.id WHERE m."workspaceId"=$1 AND o."isLocal"=false',[w]);
   if(!project||!owner)throw Error('Missing owner/project');
   const credentials=unseal(settings.ciphertext,'settings:'+w);
   for(const [key,value] of Object.entries(input.shared)){
    if(!['higgsfieldKey','higgsfieldSecret','xClientId','xClientSecret'].includes(key)||typeof value!=='string'||value.length>4096)throw Error('Unexpected credential');
    if(Object.hasOwn(credentials,key)&&credentials[key]!==value)throw Error('Existing target credential differs');
    credentials[key]=value;
   }
   await m.query('UPDATE integrations SET ciphertext=$2,revision=revision+1,"updatedAt"=now() WHERE "workspaceId"=$1',[w,seal(credentials,'settings:'+w)]);
   const imported=[];
   for(const c of input.channels){
    if(!['x','threads','instagram'].includes(c.channel)||!/^\\d+$/.test(c.userId))throw Error('Invalid source account');
    await m.query('INSERT INTO channel_connections ("workspaceId","projectId",channel) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[w,project.id,c.channel]);
    const [existing]=await m.query('SELECT * FROM channel_connections WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3 FOR UPDATE',[w,project.id,c.channel]);
    if(existing.ciphertext)throw Error('Target channel is already connected');
    const token={token:c.token,...(c.refreshToken?{refreshToken:c.refreshToken}:{}),...(c.expiresAt?{expiresAt:c.expiresAt}:{})};
    await m.query('UPDATE channel_connections SET ciphertext=$4,"userId"=$5,username=$6,"verifiedAt"=$7,"expiresAt"=$8,revision=revision+1 WHERE "workspaceId"=$1 AND "projectId"=$2 AND channel=$3',[w,project.id,c.channel,seal(token,'channel:'+w+':'+project.id+':'+c.channel),c.userId,c.username,c.verifiedAt,c.expiresAt||null]);
    imported.push({channel:c.channel,username:c.username,expired:!!c.expiresAt&&new Date(c.expiresAt).getTime()<Date.now()});
   }
   await m.query('INSERT INTO integration_events (id,"workspaceId","actorId",action) VALUES ($1,$2,$3,$4)',[randomUUID(),w,owner.id,marker]);
   await store.event(m,w,project.id,owner.id,'mellow 기존 API·채널 연결 이전');
   return {shared:Object.keys(input.shared),channels:imported};
  });
  console.log(JSON.stringify(result));
 }finally{await db.destroy();}
})().catch(()=>{console.error('Target migration failed; transaction rolled back; details withheld.');process.exitCode=1;}));`;
function ssh(project,service,code,input){const result=spawnSync('railway',['ssh','--project',project,'--service',service,'--environment','production','--identity-file',identity,'--','node','-e',code],{input,encoding:'utf8',maxBuffer:1024*1024,timeout:90000});if(result.status!==0)throw Error('Secure migration step failed (provider output withheld).');return result.stdout;}
const payload=ssh(sourceProject,'worker',read);
// Parse before forwarding to reject incidental non-JSON CLI output.
const data=JSON.parse(payload);if(!data.shared||!Array.isArray(data.channels))throw Error('Invalid migration payload.');
const result=JSON.parse(ssh(targetProject,'api',write,JSON.stringify(data)));
console.log(JSON.stringify(result,null,2));
console.log('Legacy automation remained off. No credentials were deleted; no generation or publishing was requested.');
