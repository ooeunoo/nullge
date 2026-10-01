import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { database, seedDevelopment, Store, WORKSPACE_ID } from '@nullge/database';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  actor = randomUUID();
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQYlWNgaCAAR4YCAOLoQAEz6be5AAAAAElFTkSuQmCC';
const text = {
  title: '삭제 테스트',
  caption: '지울 초안',
  brief: '',
  channel: 'x' as const,
  language: 'ko' as const,
};
let created = false;
beforeAll(async () => {
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'delete@test.invalid',
    'Delete test',
  ]);
}, 30_000);
beforeEach(async () => {
  await db.query('TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts CASCADE');
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15_000);

it('deletes an unpublished draft with its orphaned image and keeps the activity trail', async () => {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, { ...text, channel: 'instagram', image });
  const project = await store.project(WORKSPACE_ID, 'mellow');
  await db.query(
    'INSERT INTO generation_jobs (id,"workspaceId","projectId","actorId",prompt,format,channel,language,"profileRevision","settingsRevision",snapshot,"estimatedUsd","quoteExpiresAt",status,"postId",result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,0,now(),$11,$12,$13)',
    [
      randomUUID(),
      WORKSPACE_ID,
      project.id,
      actor,
      '',
      post.format,
      post.channel,
      'ko',
      project.revision,
      '{}',
      'completed',
      post.id,
      JSON.stringify({ title: post.title }),
    ],
  );
  expect(await store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision)).toEqual({ id: post.id });
  expect(await db.query('SELECT 1 FROM posts WHERE id=$1', [post.id])).toHaveLength(0);
  expect(await db.query('SELECT 1 FROM marketing_assets WHERE id=$1', [post.assetId])).toHaveLength(0);
  const jobs = await db.query('SELECT "postId",status FROM generation_jobs');
  expect(jobs).toEqual([{ postId: null, status: 'completed' }]);
  const events = (await store.dashboard(WORKSPACE_ID)).activities.map((a) => a.action).sort();
  expect(events).toEqual(['post_created', 'post_deleted']);
  expect(
    (await db.query('SELECT "postId" FROM events')).every(
      (e: { postId: string | null }) => e.postId === null,
    ),
  ).toBe(true);
});

it('keeps an image that another post still references', async () => {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, { ...text, channel: 'instagram', image });
  const other = randomUUID();
  await db.query(
    'INSERT INTO posts (id,"workspaceId","projectId",title,caption,brief,channel,language,"profileRevision",format,"assetId") SELECT $1,"workspaceId","projectId",title,caption,brief,channel,language,"profileRevision",format,"assetId" FROM posts WHERE id=$2',
    [other, post.id],
  );
  await store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision);
  expect(await db.query('SELECT 1 FROM marketing_assets WHERE id=$1', [post.assetId])).toHaveLength(1);
  expect(await db.query('SELECT 1 FROM posts WHERE id=$1', [other])).toHaveLength(1);
});

it('rejects deletion from another product, a stale revision, or after a publish request', async () => {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, text);
  await expect(store.remove(WORKSPACE_ID, 'clipit', post.id, actor, post.revision)).rejects.toMatchObject({
    status: 409,
  });
  await expect(store.remove(randomUUID(), 'mellow', post.id, actor, post.revision)).rejects.toMatchObject({
    status: 404,
  });
  await expect(store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision + 1)).rejects.toMatchObject(
    { status: 409 },
  );
  await db.query(`UPDATE posts SET "publishStatus"='queued' WHERE id=$1`, [post.id]);
  await expect(store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision)).rejects.toMatchObject({
    status: 409,
  });
  expect(await db.query('SELECT 1 FROM posts WHERE id=$1', [post.id])).toHaveLength(1);
  await db.query(`UPDATE posts SET "publishStatus"=NULL WHERE id=$1`, [post.id]);
  await store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision);
  await expect(store.remove(WORKSPACE_ID, 'mellow', post.id, actor, post.revision)).rejects.toMatchObject({
    status: 409,
  });
});

it('records an external publication and lets a Buffer-rejected post be deleted', async () => {
  const post = await store.create(WORKSPACE_ID, 'mellow', actor, text);
  const project = await store.project(WORKSPACE_ID, 'mellow');
  const published = await store.recordPublication(
    WORKSPACE_ID,
    'mellow',
    post.id,
    actor,
    post.revision,
    'https://x.com/mellow_call/status/1',
  );
  expect(published).toMatchObject({
    status: 'approved',
    publishStatus: 'published',
    publishedUrl: 'https://x.com/mellow_call/status/1',
    revision: post.revision + 1,
  });
  expect(published.approvedAt).not.toBeNull();
  await expect(
    store.remove(WORKSPACE_ID, 'mellow', post.id, actor, published.revision),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    store.recordPublication(
      WORKSPACE_ID,
      'mellow',
      post.id,
      actor,
      published.revision,
      'https://x.com/mellow_call/status/2',
    ),
  ).rejects.toMatchObject({ status: 409 });
  const failed = await store.create(WORKSPACE_ID, 'mellow', actor, text);
  await db.query(`UPDATE posts SET "publishStatus"='failed',"publishError"='rejected' WHERE id=$1`, [
    failed.id,
  ]);
  await db.query(
    'INSERT INTO publication_jobs (id,"workspaceId","projectId","postId","actorId","connectionRevision",snapshot,status) VALUES ($1,$2,$3,$4,$5,1,$6,$7)',
    [randomUUID(), WORKSPACE_ID, project.id, failed.id, actor, '{}', 'failed'],
  );
  expect(await store.remove(WORKSPACE_ID, 'mellow', failed.id, actor, failed.revision)).toEqual({
    id: failed.id,
  });
  expect(await db.query('SELECT 1 FROM publication_jobs WHERE "postId"=$1', [failed.id])).toHaveLength(0);
  expect((await store.dashboard(WORKSPACE_ID)).activities.map((a) => a.action)).toContain(
    'post_published_externally',
  );
});
