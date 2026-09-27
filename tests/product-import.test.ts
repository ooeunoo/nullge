import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { database, WORKSPACE_ID } from '@nullge/database';
import { ProductProfiles1790352000000 } from '../packages/database/src/product-profiles-migration';
import { legacyInitialProducts } from '../packages/database/src/seed';
import { productCatalog20260925 } from '../packages/database/src/product-catalog-20260925';
import { productBrands } from '../apps/console/components/product-brands';
import { MinimoRepositoryCorrection1790352300000 } from '../packages/database/src/minimo-correction-migration';
import { currentProductCatalog, minimoDesktopPet } from '../packages/database/src/minimo-desktop-pet';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
const url = new URL(adminUrl);
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local test DB required');
const name = `nullge_test_${randomUUID().replaceAll('-','')}`;
const admin = database(adminUrl);
url.pathname = `/${name}`;
const db = database(url.toString());
let created = false;
beforeAll(async()=>{
  await admin.initialize(); await admin.query(`CREATE DATABASE "${name}"`); created=true;
  await db.initialize(); await db.runMigrations();
},30_000);
afterAll(async()=>{
  if(db.isInitialized) await db.destroy();
  if(created) await admin.query(`DROP DATABASE "${name}"`);
  if(admin.isInitialized) await admin.destroy();
});

async function legacyFixture() {
  const q=db.createQueryRunner(); await q.connect(); await q.startTransaction();
  for(const p of legacyInitialProducts) {
    const [row]=await q.query('INSERT INTO projects (id,"workspaceId",slug,name,color,description,audience,facts,tone,avoid,website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [randomUUID(),WORKSPACE_ID,p.slug,p.name,p.color,p.description,p.audience,p.facts,p.tone,p.avoid,p.website]);
    await q.query('INSERT INTO profile_versions ("workspaceId","projectId",revision,snapshot) VALUES ($1,$2,1,$3)',[WORKSPACE_ID,row.id,JSON.stringify(row)]);
  }
  return q;
}

it('enriches only bootstrap profiles, preserves v1, and is idempotent',async()=>{
  const q=await legacyFixture();
  try {
    const migration=new ProductProfiles1790352000000(); await migration.up(q); await migration.up(q);
    const rows=await q.query('SELECT * FROM projects');
    expect(rows).toHaveLength(4);
    for(const row of rows) {
      expect(row.revision).toBe(2); expect(row.profileReviewedAt).toBeNull();
      expect(row.facts).toBe(productCatalog20260925.find(p=>p.slug===row.slug)!.facts);
      const versions=await q.query('SELECT * FROM profile_versions WHERE "projectId"=$1 ORDER BY revision',[row.id]);
      expect(versions).toHaveLength(2);
      expect(versions[0].snapshot.facts).toBe(legacyInitialProducts.find(p=>p.slug===row.slug)!.facts);
    }
    expect(await q.query('SELECT * FROM events')).toHaveLength(4);
  } finally {await q.rollbackTransaction();await q.release();}
});

it('does not replace edited, reviewed, content-linked, or other-workspace profiles',async()=>{
  const q=await legacyFixture();
  try {
    await q.query("UPDATE projects SET description='사용자 설명' WHERE slug='clipit'");
    await q.query("UPDATE projects SET revision=2 WHERE slug='minimo'");
    await q.query('UPDATE projects SET "profileReviewedAt"=now() WHERE slug=\'desk\'');
    const [mellow]=await q.query("SELECT id FROM projects WHERE slug='mellow'");
    await q.query('INSERT INTO posts (id,"workspaceId","projectId",title,channel,language,"profileRevision") VALUES ($1,$2,$3,$4,$5,$6,1)',[randomUUID(),WORKSPACE_ID,mellow.id,'보존할 콘텐츠','x','ko']);
    const other=randomUUID();await q.query('INSERT INTO workspaces VALUES ($1,$2)',[other,'Other']);
    await q.query('INSERT INTO projects (id,"workspaceId",slug,name,color) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),other,'movy','Untouched','#123456']);
    const before=await q.query('SELECT * FROM projects ORDER BY id');
    await new ProductProfiles1790352000000().up(q);
    expect(await q.query('SELECT * FROM projects ORDER BY id')).toEqual(before);
    expect(await q.query('SELECT * FROM events')).toHaveLength(0);
    expect(await q.query('SELECT * FROM posts')).toHaveLength(1);
  } finally {await q.rollbackTransaction();await q.release();}
});

it('corrects the minimo repository without renaming or altering the other products',async()=>{
  const q=await legacyFixture();
  try {
    await new ProductProfiles1790352000000().up(q);
    const other=await q.query("SELECT * FROM projects WHERE slug!='minimo' ORDER BY id");
    const correction=new MinimoRepositoryCorrection1790352300000();
    await correction.up(q); await correction.up(q);
    const [row]=await q.query("SELECT * FROM projects WHERE slug='minimo'");
    expect(row).toMatchObject({...minimoDesktopPet,revision:3,profileReviewedAt:null});
    expect(await q.query("SELECT * FROM projects WHERE slug!='minimo' ORDER BY id")).toEqual(other);
    expect(await q.query('SELECT * FROM profile_versions WHERE "projectId"=$1',[row.id])).toHaveLength(3);
    expect(await q.query("SELECT * FROM events WHERE action='profile_corrected'")).toHaveLength(1);
  } finally {await q.rollbackTransaction();await q.release();}
});

it('does not overwrite a user-edited minimo during repository correction',async()=>{
  const q=await legacyFixture();
  try {
    await new ProductProfiles1790352000000().up(q);
    await q.query("UPDATE projects SET audience='직접 설정한 고객' WHERE slug='minimo'");
    const before=await q.query("SELECT * FROM projects WHERE slug='minimo'");
    await new MinimoRepositoryCorrection1790352300000().up(q);
    expect(await q.query("SELECT * FROM projects WHERE slug='minimo'")).toEqual(before);
  } finally {await q.rollbackTransaction();await q.release();}
});

it('ships a local, nonempty logo for every catalog product',()=>{
  for(const product of currentProductCatalog) {
    const brand=productBrands[product.slug];
    expect(brand).toBeDefined();expect(brand.logo).toMatch(/^\/brands\/[a-z]+\.(png|svg)$/);
    const bytes=readFileSync(new URL(`../apps/console/public${brand.logo}`,import.meta.url));
    expect(bytes.length).toBeGreaterThan(100);
    if(brand.logo.endsWith('.svg')) {
      expect(bytes.toString()).toContain('<svg');
      expect(bytes.toString()).not.toMatch(/<script|<foreignObject|\son\w+=|(?:href|src)=/i);
    } else expect(bytes.subarray(1,4).toString()).toBe('PNG');
  }
});

it('uses the approved minimo companion vector without changing its repository identity',()=>{
  expect(productBrands.minimo).toMatchObject({logo:'/brands/minimo.svg',repository:'~/projects/eun/desktop_pet',source:'assets/brand/mark.svg'});
  const svg=readFileSync(new URL('../apps/console/public/brands/minimo.svg',import.meta.url),'utf8');
  expect(svg).toContain('#E4863A');
  expect(svg).toContain('data-eyes="true"');
  expect(svg).not.toContain('crispEdges');
});
