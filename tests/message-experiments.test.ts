import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { database, seedDevelopment, Store, MessageStore, WORKSPACE_ID } from '@nullge/database';
import { responseRate } from '@nullge/contracts';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  messages = new MessageStore(db),
  actor = randomUUID();
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
    'msg@test.invalid',
    'Msg',
  ]);
}, 30000);
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

const post = (title: string) =>
  store.create(WORKSPACE_ID, 'mellow', actor, {
    title,
    caption: title,
    brief: '',
    channel: 'threads',
    language: 'ko',
  });
const publish = (id: string) => db.query(`UPDATE posts SET "publishStatus"='published' WHERE id=$1`, [id]);

it('aggregates published results per message and compares saves plus shares per reach', async () => {
  const a = await messages.create(WORKSPACE_ID, 'mellow', actor, {
    label: 'A 기억하는 친구',
    description: '',
  });
  const c = await messages.create(WORKSPACE_ID, 'mellow', actor, {
    label: 'C 틀려도 괜찮아',
    description: '',
  });
  const p1 = await post('A1'),
    p2 = await post('A2'),
    p3 = await post('C1');
  for (const [p, m] of [
    [p1, a],
    [p2, a],
    [p3, c],
  ] as const)
    await messages.tag(WORKSPACE_ID, 'mellow', p.id, actor, m.id);
  // Tagging leaves the post revision and approval alone.
  const [row] = await db.query('SELECT revision FROM posts WHERE id=$1', [p1.id]);
  expect(row.revision).toBe(p1.revision);
  for (const p of [p1, p2, p3]) await publish(p.id);
  await messages.recordMetrics(WORKSPACE_ID, 'mellow', p1.id, actor, {
    reach: 1000,
    saves: 30,
    shares: 10,
    likes: 0,
    comments: 0,
    profileVisits: 5,
    linkClicks: 1,
  });
  await messages.recordMetrics(WORKSPACE_ID, 'mellow', p2.id, actor, {
    reach: 1000,
    saves: 10,
    shares: 0,
    likes: 0,
    comments: 0,
    profileVisits: 0,
    linkClicks: 0,
  });
  await messages.recordMetrics(WORKSPACE_ID, 'mellow', p3.id, actor, {
    reach: 500,
    saves: 40,
    shares: 20,
    likes: 0,
    comments: 0,
    profileVisits: 0,
    linkClicks: 0,
  });
  // Recording again replaces the numbers instead of adding a second row.
  await messages.recordMetrics(WORKSPACE_ID, 'mellow', p3.id, actor, {
    reach: 600,
    saves: 40,
    shares: 20,
    likes: 0,
    comments: 0,
    profileVisits: 0,
    linkClicks: 0,
  });
  const list = await messages.list(WORKSPACE_ID, 'mellow');
  const A = list.find((m) => m.id === a.id)!,
    C = list.find((m) => m.id === c.id)!;
  expect(A).toMatchObject({ posts: 2, published: 2, measured: 2, reach: 2000, saves: 40, shares: 10 });
  expect(C).toMatchObject({ posts: 1, measured: 1, reach: 600 });
  expect(responseRate(A)).toBeCloseTo(0.025);
  expect(responseRate(C)).toBeCloseTo(0.1);
  const dash = await store.dashboard(WORKSPACE_ID);
  expect(dash.posts.find((p) => p.id === p3.id)!.metrics).toMatchObject({ reach: 600, saves: 40 });
});

it('refuses results for unpublished posts, foreign messages and impossible numbers', async () => {
  const draft = await post('초안');
  await expect(
    messages.recordMetrics(WORKSPACE_ID, 'mellow', draft.id, actor, {
      reach: 10,
      saves: 1,
      shares: 0,
      likes: 0,
      comments: 0,
      profileVisits: 0,
      linkClicks: 0,
    }),
  ).rejects.toMatchObject({ status: 400 });
  const other = await messages.create(WORKSPACE_ID, 'clipit', actor, { label: '다른 제품', description: '' });
  await expect(messages.tag(WORKSPACE_ID, 'mellow', draft.id, actor, other.id)).rejects.toMatchObject({
    status: 400,
  });
  await publish(draft.id);
  await expect(
    messages.recordMetrics(WORKSPACE_ID, 'mellow', draft.id, actor, {
      reach: 10,
      saves: 500,
      shares: 0,
      likes: 0,
      comments: 0,
      profileVisits: 0,
      linkClicks: 0,
    }),
  ).rejects.toMatchObject({ status: 400 });
  const updated = await messages.update(
    WORKSPACE_ID,
    'mellow',
    (await messages.list(WORKSPACE_ID, 'mellow'))[0]!.id,
    actor,
    { status: 'winner' },
  );
  expect(updated.status).toBe('winner');
});
