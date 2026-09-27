import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { database, seedDevelopment, Store, WORKSPACE_ID } from '@nullge/database';
import { MAX_POST_VIDEO_BYTES, postInput } from '@nullge/contracts';

const adminUrl=process.env.NULLGE_TEST_DATABASE_ADMIN_URL||'postgres://nullge@127.0.0.1:5549/postgres';
if(!['127.0.0.1','localhost'].includes(new URL(adminUrl).hostname))throw Error('Local tests only');
const name=`nullge_test_${randomUUID().replaceAll('-','')}`, url=new URL(adminUrl);url.pathname=`/${name}`;
const admin=database(adminUrl),db=database(url.toString()),store=new Store(db),actor=randomUUID();
function box(type:string,payload:Buffer){const size=Buffer.alloc(4);size.writeUInt32BE(8+payload.length);return Buffer.concat([size,Buffer.from(type,'latin1'),payload]);}
const mp4=Buffer.concat([box('ftyp',Buffer.from('isom\0\0\2\0isomiso2mp41','latin1')),box('moov',Buffer.alloc(40)),box('mdat',Buffer.alloc(64))]);
const video=`data:video/mp4;base64,${mp4.toString('base64')}`;
const input={title:'영상 첨부 테스트',caption:'퇴근길 통화',brief:'',channel:'instagram' as const,language:'ko' as const,image:video};
let created=false;
beforeAll(async()=>{
  await admin.initialize();await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await db.initialize();await db.runMigrations();await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)',[actor,'video@test.invalid','Video test']);
},30_000);
beforeEach(async()=>{await db.query('TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts CASCADE');});
afterAll(async()=>{if(db.isInitialized)await db.destroy();if(created)await admin.query(`DROP DATABASE "${name}"`);if(admin.isInitialized)await admin.destroy();},15_000);

it('stores an uploaded MP4 unchanged as a video post',async()=>{
  expect(postInput.safeParse(input).success).toBe(true);
  const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
  expect(post).toMatchObject({format:'video',status:'draft',publishStatus:null});
  const [asset]=await db.query('SELECT mime,content FROM marketing_assets WHERE id=$1',[post.assetId]);
  expect(asset.mime).toBe('video/mp4');
  expect(Buffer.compare(asset.content,mp4)).toBe(0);
});

it('replaces an image with a video on update and switches the format',async()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQYlWNgaCAAR4YCAOLoQAEz6be5AAAAAElFTkSuQmCC';
  const post=await store.create(WORKSPACE_ID,'mellow',actor,{...input,image});
  expect(post.format).toBe('image');
  const updated=await store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,revision:post.revision});
  expect(updated.format).toBe('video');
  expect(updated.assetId).not.toBe(post.assetId);
});

it('rejects files that only claim to be MP4, truncated data, and oversized videos',async()=>{
  const fake=`data:video/mp4;base64,${Buffer.concat([Buffer.from('<html>bad</html>'),Buffer.alloc(80)]).toString('base64')}`;
  const noMoov=`data:video/mp4;base64,${Buffer.concat([box('ftyp',Buffer.from('isom\0\0\2\0','latin1')),box('mdat',Buffer.alloc(80))]).toString('base64')}`;
  for(const bad of [fake,noMoov,video.slice(0,-40)]){
    await expect(store.create(WORKSPACE_ID,'mellow',actor,{...input,image:bad})).rejects.toMatchObject({status:400});
  }
  expect(postInput.safeParse({...input,image:`data:video/mp4;base64,${Buffer.alloc(MAX_POST_VIDEO_BYTES+1).toString('base64')}`}).success).toBe(false);
  expect(await db.query('SELECT 1 FROM marketing_assets')).toHaveLength(0);
});
