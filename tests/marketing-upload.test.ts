import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { database, seedDevelopment, Store, MarketingStore, WORKSPACE_ID } from '@nullge/database';
import { MAX_POST_IMAGE_BYTES, postInput } from '@nullge/contracts';

const adminUrl=process.env.NULLGE_TEST_DATABASE_ADMIN_URL||'postgres://nullge@127.0.0.1:5549/postgres';
if(!['127.0.0.1','localhost'].includes(new URL(adminUrl).hostname))throw Error('Local tests only');
const name=`nullge_test_${randomUUID().replaceAll('-','')}`, url=new URL(adminUrl);url.pathname=`/${name}`;
const admin=database(adminUrl),db=database(url.toString()),store=new Store(db),marketing=new MarketingStore(db),actor=randomUUID();
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQYlWNgaCAAR4YCAOLoQAEz6be5AAAAAElFTkSuQmCC';
const input={title:'첨부 테스트',caption:'브랜드 이미지',brief:'',channel:'instagram' as const,language:'ko' as const,image};
let created=false;
beforeAll(async()=>{
  await admin.initialize();await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await db.initialize();await db.runMigrations();await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)',[actor,'upload@test.invalid','Upload test']);
},30_000);
beforeEach(async()=>{await db.query('TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts CASCADE');});
afterAll(async()=>{if(db.isInitialized)await db.destroy();if(created)await admin.query(`DROP DATABASE "${name}"`);if(admin.isInitialized)await admin.destroy();},15_000);

it('stores the decoded image and draft atomically without a generation or publication job',async()=>{
  const post=await store.create(WORKSPACE_ID,'mellow',actor,postInput.parse(input));
  expect(post).toMatchObject({format:'image',status:'draft',publishStatus:null});
  expect(post).not.toHaveProperty('image');
  const [asset]=await db.query('SELECT * FROM marketing_assets WHERE id=$1',[post.assetId]);
  expect(asset).toMatchObject({workspaceId:WORKSPACE_ID,projectId:post.projectId,mime:'image/jpeg',jobId:null});
  expect(asset.content.subarray(0,3)).toEqual(Buffer.from([255,216,255]));
  expect((await db.query('SELECT * FROM generation_jobs'))).toHaveLength(0);
  expect((await db.query('SELECT * FROM publication_jobs'))).toHaveLength(0);
  expect((await store.dashboard(WORKSPACE_ID)).posts[0].assetId).toBe(post.assetId);
});

it('rejects invalid, mismatched, truncated and oversized files without creating assets or drafts',async()=>{
  for(const bad of [image.replace('image/png','image/jpeg'),'data:image/png;base64,'+Buffer.from('<script>bad</script>').toString('base64'),image.slice(0,-64),`data:image/png;base64,${Buffer.alloc(MAX_POST_IMAGE_BYTES+1).toString('base64')}`]){
    await expect(store.create(WORKSPACE_ID,'mellow',actor,{...input,image:bad})).rejects.toMatchObject({status:400});
  }
  expect((await db.query('SELECT * FROM marketing_assets'))).toHaveLength(0);
  expect((await store.dashboard(WORKSPACE_ID)).posts).toHaveLength(0);
});

it('preserves an existing attachment when editing only the caption, and invalidates approval on replacement',async()=>{
  const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
  const {image:_,...text}=input;
  const edited=await store.update(WORKSPACE_ID,'mellow',post.id,actor,{...text,caption:'수정',revision:post.revision});
  expect(edited.assetId).toBe(post.assetId);
  const project=await store.project(WORKSPACE_ID,'mellow');await store.reviewProfile(WORKSPACE_ID,'mellow',actor,project.revision);
  const review=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,edited.revision,'review');
  const approved=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,review.revision,'approve');
  const replaced=await store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,revision:approved.revision});
  expect(replaced.assetId).not.toBe(post.assetId);expect(replaced).toMatchObject({status:'draft',approvedAt:null});
  expect((await db.query('SELECT * FROM marketing_assets WHERE id=$1',[post.assetId]))).toHaveLength(1);
});

it('rolls back attachments on wrong product, wrong workspace, stale revision or locked publication',async()=>{
  const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
  await expect(store.update(WORKSPACE_ID,'clipit',post.id,actor,{...input,revision:post.revision})).rejects.toMatchObject({status:409});
  await expect(store.update(randomUUID(),'mellow',post.id,actor,{...input,revision:post.revision})).rejects.toMatchObject({status:404});
  await expect(store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,revision:999})).rejects.toMatchObject({status:409});
  await db.query(`UPDATE posts SET "publishStatus"='queued' WHERE id=$1`,[post.id]);
  await expect(store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,revision:post.revision})).rejects.toMatchObject({status:409});
  expect((await db.query('SELECT * FROM marketing_assets'))).toHaveLength(1);
  expect((await store.dashboard(WORKSPACE_ID)).posts[0].assetId).toBe(post.assetId);
  await expect(marketing.asset(randomUUID(),post.assetId!)).rejects.toMatchObject({status:404});
});

it('keeps only one new attachment under concurrent updates',async()=>{
  const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
  const results=await Promise.allSettled([1,2].map(()=>store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,revision:post.revision})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await db.query('SELECT * FROM marketing_assets'))).toHaveLength(2);
});
