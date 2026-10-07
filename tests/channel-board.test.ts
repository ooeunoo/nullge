import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { database, seedDevelopment, ChannelBoardStore, WORKSPACE_ID } from '@nullge/database';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  board = new ChannelBoardStore(db);
let created = false;

beforeAll(async () => {
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
}, 30000);
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

it('lists kept channels first and keeps each product separate', async () => {
  const base = {
    startedOn: '2026-10-07',
    endsOn: '2026-10-21',
    goal: '2주, 저장+공유율 2% 이상',
    result: '',
  };
  const ig = await board.create(WORKSPACE_ID, 'mellow', {
    ...base,
    name: 'Instagram 한국어',
    status: 'testing',
  });
  await board.create(WORKSPACE_ID, 'mellow', {
    ...base,
    name: 'Apple Ads',
    status: 'idea',
    startedOn: null,
    endsOn: null,
  });
  await board.create(WORKSPACE_ID, 'clipit', { ...base, name: 'TikTok', status: 'testing' });
  await board.update(WORKSPACE_ID, 'mellow', ig.id, { status: 'keep', result: '반응률 3.1%' });
  const rows = await board.list(WORKSPACE_ID, 'mellow');
  expect(rows.map((r) => [r.name, r.status])).toEqual([
    ['Instagram 한국어', 'keep'],
    ['Apple Ads', 'idea'],
  ]);
  expect(rows[0]).toMatchObject({ startedOn: '2026-10-07', endsOn: '2026-10-21', result: '반응률 3.1%' });
  await expect(board.update(WORKSPACE_ID, 'clipit', ig.id, { status: 'stopped' })).rejects.toMatchObject({
    status: 404,
  });
  await expect(board.update(WORKSPACE_ID, 'mellow', ig.id, { endsOn: '2026-10-01' })).rejects.toMatchObject({
    status: 400,
  });
});
