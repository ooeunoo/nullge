import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database, seedDevelopment, Store, WORKSPACE_ID } from '@nullge/database';
import { postInput, profileInput } from '@nullge/contracts';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
const parsed = new URL(adminUrl);
if (!['127.0.0.1','localhost'].includes(parsed.hostname)) throw new Error('Tests require a local PostgreSQL instance.');
const name=`nullge_test_${randomUUID().replaceAll('-','')}`;
const admin=database(adminUrl);
const testUrl=new URL(adminUrl); testUrl.pathname=`/${name}`;
const db=database(testUrl.toString());
const actor=randomUUID();
const store=new Store(db);
const input={ title:'회화의 첫 문장',caption:'오늘의 이야기를 목소리로 꺼내 보세요.',brief:'통화 기능 소개',channel:'x' as const,language:'ko' as const };
let created=false;
beforeAll(async()=>{
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`); created=true;
  await db.initialize();await db.runMigrations();await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)',[actor,'test@nullge.invalid','Test operator']);
},30_000);
afterAll(async()=>{
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
},15_000);

describe('product boundaries and review workflow',()=>{
  it('starts with five populated, unreviewed products and no invented production posts',async()=>{
    const dashboard=await store.dashboard(WORKSPACE_ID);
    expect(dashboard.projects).toHaveLength(5);
    expect(dashboard.projects.map(p=>p.slug).sort()).toEqual(['clipit','desk','mellow','minimo','movy']);
    expect(dashboard.projects.find(p=>p.slug==='minimo')!.description).toContain('데스크톱 펫');
    expect(dashboard.projects.find(p=>p.slug==='minimo')!.name).toBe('minimo');
    for (const project of dashboard.projects) {
      expect(profileInput.safeParse({revision:project.revision,description:project.description,audience:project.audience,facts:project.facts,tone:project.tone,avoid:project.avoid,website:project.website}).success).toBe(true);
      expect(project.facts).toContain('근거:');
      expect(project.audience.length).toBeGreaterThan(10);
    }
    expect(dashboard.projects.every(p=>p.profileReviewedAt===null)).toBe(true);
    expect(dashboard.posts).toHaveLength(0);
    expect((await store.dashboard(randomUUID())).projects).toHaveLength(0);
  });
  it('rejects cross-product updates and approvals',async()=>{
    const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
    await expect(store.update(WORKSPACE_ID,'clipit',post.id,actor,{...input,revision:post.revision})).rejects.toMatchObject({status:409});
    await expect(store.transition(WORKSPACE_ID,'clipit',post.id,actor,post.revision,'review')).rejects.toMatchObject({status:409});
    await expect(store.create(randomUUID(),'mellow',actor,input)).rejects.toMatchObject({status:404});
  });
  it('allows only one write for a revision under concurrent edits',async()=>{
    const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
    const results=await Promise.allSettled([
      store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,title:'First',revision:1}),
      store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,title:'Second',revision:1}),
    ]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  });
  it('requires reviewed product facts before approving a post',async()=>{
    const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
    const reviewed=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,post.revision,'review');
    await expect(store.transition(WORKSPACE_ID,'mellow',post.id,actor,reviewed.revision,'approve')).rejects.toMatchObject({status:400});
    const project=await store.project(WORKSPACE_ID,'mellow');
    await store.reviewProfile(WORKSPACE_ID,'mellow',actor,project.revision);
    const approved=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,reviewed.revision,'approve');
    expect(approved.status).toBe('approved');expect(approved.approvedAt).not.toBeNull();
    const edited=await store.update(WORKSPACE_ID,'mellow',post.id,actor,{...input,caption:'수정된 문구',revision:approved.revision});
    expect(edited.status).toBe('draft');expect(edited.approvedAt).toBeNull();
  });
  it('invalidates review on profile edits and preserves immutable older versions',async()=>{
    const post=await store.create(WORKSPACE_ID,'mellow',actor,input);
    const review=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,post.revision,'review');
    await store.transition(WORKSPACE_ID,'mellow',post.id,actor,review.revision,'approve');
    const old=await store.project(WORKSPACE_ID,'mellow');
    const next=await store.updateProfile(WORKSPACE_ID,'mellow',actor,{revision:old.revision,description:'새 제품 설명',audience:old.audience,facts:old.facts,tone:old.tone,avoid:old.avoid,website:old.website});
    expect(next.revision).toBe(old.revision+1);expect(next.profileReviewedAt).toBeNull();
    const current=(await store.dashboard(WORKSPACE_ID)).posts.find(p=>p.id===post.id)!;
    expect(current.status).toBe('draft');expect(current.profileRevision).toBe(old.revision);
    const [version]=await db.query('SELECT snapshot FROM profile_versions WHERE "projectId"=$1 AND revision=$2',[old.id,old.revision]);
    expect(version.snapshot.description).toBe(old.description);
    await store.reviewProfile(WORKSPACE_ID,'mellow',actor,next.revision);
    const pending=await store.transition(WORKSPACE_ID,'mellow',post.id,actor,current.revision,'review');
    await expect(store.transition(WORKSPACE_ID,'mellow',post.id,actor,pending.revision,'approve')).rejects.toMatchObject({status:400});
  });
  it('does not replace edited project data on repeated development seed',async()=>{
    const before=await store.project(WORKSPACE_ID,'mellow');
    await seedDevelopment(db);
    expect(await store.project(WORKSPACE_ID,'mellow')).toEqual(before);
  });
  it('rejects injected ownership fields and unsafe product URLs',()=>{
    expect(postInput.safeParse({...input,projectId:randomUUID()}).success).toBe(false);
    expect(profileInput.safeParse({revision:1,description:'test',audience:'',facts:'test',tone:'',avoid:'',website:'javascript:alert(1)'}).success).toBe(false);
  });
});
