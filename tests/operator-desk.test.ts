import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { database, seedDevelopment, DeskStore, WORKSPACE_ID } from '@nullge/database';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  desk = new DeskStore(db),
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
    'desk@test.invalid',
    'Desk',
  ]);
}, 30000);
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

it('keeps open tasks and recently finished ones, with product and due date', async () => {
  const { id } = await desk.addTask(WORKSPACE_ID, actor, {
    title: '앱 화면 녹화 1개',
    detail: '잠금 화면에 전화가 울리는 장면부터 8~15초',
    link: null,
    kind: 'todo',
    dueOn: null,
    projectSlug: 'mellow',
  });
  await desk.addTask(WORKSPACE_ID, actor, {
    title: 'Apple 피처링 신청',
    detail: '',
    link: 'https://developer.apple.com/app-store/getting-featured/',
    kind: 'deadline',
    dueOn: '2026-11-03',
    projectSlug: null,
  });
  let d = await desk.desk(WORKSPACE_ID);
  expect(d.tasks.map((t) => [t.title, t.status, t.dueOn])).toEqual([
    ['Apple 피처링 신청', 'open', '2026-11-03'],
    ['앱 화면 녹화 1개', 'open', null],
  ]);
  await desk.setTask(WORKSPACE_ID, id, 'done');
  d = await desk.desk(WORKSPACE_ID);
  expect(d.tasks.find((t) => t.id === id)!.status).toBe('done');
  await db.query(`UPDATE operator_tasks SET "doneAt"=now()-interval '20 days' WHERE id=$1`, [id]);
  expect((await desk.desk(WORKSPACE_ID)).tasks.some((t) => t.id === id)).toBe(false);
  await expect(desk.setTask(randomUUID(), id, 'reopen')).rejects.toMatchObject({ status: 404 });
});

it('sums this month spend, Console generation estimates and the cap', async () => {
  const now = Date.parse('2026-10-15T03:00:00Z');
  await desk.addSpend(WORKSPACE_ID, actor, {
    spentOn: '2026-10-07',
    category: 'generation',
    amountKrw: 6720,
    note: 'Veo 장면',
    projectSlug: 'mellow',
  });
  await desk.addSpend(WORKSPACE_ID, actor, {
    spentOn: '2026-09-30',
    category: 'ads',
    amountKrw: 50000,
    note: '지난달',
    projectSlug: null,
  });
  await desk.setBudget(WORKSPACE_ID, 210000);
  const d = await desk.desk(WORKSPACE_ID, now);
  expect(d.month).toBe('2026-10');
  expect(d.spend.map((s) => s.amountKrw)).toEqual([6720]);
  expect(d.monthlyCapKrw).toBe(210000);
  expect(typeof d.generationUsd).toBe('number');
  await desk.deleteSpend(WORKSPACE_ID, d.spend[0]!.id);
  expect((await desk.desk(WORKSPACE_ID, now)).spend).toEqual([]);
});
