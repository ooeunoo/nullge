import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  Store,
  MarketingStore,
  MarketingWorker,
  WORKSPACE_ID,
} from '@nullge/database';
import { generationInput } from '@nullge/contracts';
import {
  contentHistory,
  isRepeatedContent,
  HISTORY_BYTES,
  type ContentCandidate,
} from '../packages/database/src/marketing-history';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname))
  throw Error('Tests require local database');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  marketing = new MarketingStore(db),
  actor = randomUUID();
let created = false;
const input = generationInput.parse({ format: 'text' });
const candidates: ContentCandidate[] = [
  {
    title: '표현을 다시 만나는 시간',
    caption: '통화에서 만난 표현을 다시 살펴보세요. 오늘 기억하고 싶은 표현은 무엇인가요?',
    mediaPrompt: 'A notebook in soft daylight.',
    topic: '표현 복습',
    angle: '통화가 끝난 뒤 표현을 되짚기',
    keyMessage: '대화 이후 표현을 다시 살펴보기',
    visualConcept: '햇빛 아래 펼쳐진 복습 노트',
  },
  {
    title: '일상 이야기를 꺼내요',
    caption: '오늘 점심은 어땠나요? AI 친구와 목소리로 일상을 이야기해 보세요.',
    mediaPrompt: 'An adult holding a phone by a lunch table.',
    topic: '일상 대화',
    angle: '점심 이야기를 시작으로 음성 대화하기',
    keyMessage: 'AI 친구에게 일상을 목소리로 전하기',
    visualConcept: '점심 식탁에서 휴대폰을 든 성인',
  },
  {
    title: '나에게 맞는 통화 시간',
    caption: '내가 정한 시간에 AI 통화를 예약해 보세요. 어느 시간이 편한가요?',
    mediaPrompt: 'An abstract clock over a calm blue background.',
    topic: '예약 통화',
    angle: '생활 리듬에 맞는 시간 선택',
    keyMessage: '원하는 시간에 통화를 예약하기',
    visualConcept: '파란 배경 위 추상적인 시계',
  },
];
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const completion = (items = candidates) =>
  json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: items }) } }],
    usage: { total_tokens: 150 },
  });
async function draft(slug: string, candidate: ContentCandidate) {
  return store.create(WORKSPACE_ID, slug, actor, {
    title: candidate.title,
    caption: candidate.caption,
    brief: '',
    channel: 'threads',
    language: 'ko',
  });
}
async function enqueue(prompt = '', format = 'text') {
  const quote = await marketing.quote(
    WORKSPACE_ID,
    'mellow',
    actor,
    generationInput.parse({ format, prompt }),
  );
  await marketing.confirm(WORKSPACE_ID, 'mellow', actor, quote.id);
  return quote;
}
async function job(id: string) {
  return (await db.query('SELECT * FROM generation_jobs WHERE id=$1', [id]))[0];
}
beforeAll(async () => {
  vi.stubEnv('MARKETING_SECRET_KEY', 'ab'.repeat(32));
  vi.stubEnv('HIGGSFIELD_MEDIA_HOSTS', 'media.example.invalid');
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'generation@test.invalid',
    'Test',
  ]);
  const settings = await marketing.settings(WORKSPACE_ID);
  await marketing.saveSettings(WORKSPACE_ID, actor, {
    ...settings,
    secrets: { openaiKey: 'test-not-real', higgsfieldKey: 'test', higgsfieldSecret: 'test' },
    clear: [],
    imageUsd: 0.1,
    videoUsd: 1,
  });
}, 30000);
beforeEach(async () => {
  await db.query('TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts CASCADE');
  // No accidental real network calls, including on a failed assertion/setup.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw Error('Unexpected network request in test');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  vi.unstubAllEnvs();
  if (db.isInitialized) await db.destroy();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  if (admin.isInitialized) await admin.destroy();
}, 15000);

describe('one-click generation with product memory', () => {
  it('accepts type alone and keeps strict input/channel validation', () => {
    expect(input).toEqual({ format: 'text', prompt: '', channel: 'threads', language: 'ko' });
    expect(generationInput.parse({ format: 'video', prompt: '  ' }).channel).toBe('instagram');
    expect(
      generationInput.parse({ format: 'image', prompt: '봄', channel: 'x', language: 'en' }),
    ).toMatchObject({ prompt: '봄', channel: 'x', language: 'en' });
    expect(generationInput.safeParse({ format: 'text', channel: 'instagram' }).success).toBe(false);
    expect(generationInput.safeParse({ format: 'text', autoPublish: true }).success).toBe(false);
  });
  it('automatically estimates without providers and reuses only identical actor-bound quotes', async () => {
    const first = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    const same = await marketing.quote(WORKSPACE_ID, 'mellow', actor, input);
    expect(same.id).toBe(first.id);
    expect((await job(first.id)).snapshot.plannerVersion).toBe(2);
    expect(first.totalUsd).toBeGreaterThan((HISTORY_BYTES * 0.15) / 1e6);
    const other = await marketing.quote(WORKSPACE_ID, 'mellow', actor, { ...input, prompt: '다른 소재' });
    expect(other.id).not.toBe(first.id);
    await new MarketingWorker(db).tick();
    expect(fetch).not.toHaveBeenCalled();
    expect(await marketing.jobs(WORKSPACE_ID, 'mellow')).toHaveLength(0);
  });
  it('reads fresh history after quoting and selects a distinct candidate across formats', async () => {
    const quote = await enqueue();
    const previous = await draft('mellow', candidates[0]);
    await db.query(`UPDATE posts SET "publishStatus"='published',format='image' WHERE id=$1`, [previous.id]);
    await draft('clipit', candidates[1]);
    const fake = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      const memory = JSON.parse(request.messages[1].content).contentHistory;
      expect(memory.map((row: any) => row.id)).toEqual([previous.id]);
      expect(request.messages[0].content).toContain('blank prompt');
      return completion();
    });
    vi.stubGlobal('fetch', fake);
    await new MarketingWorker(db).tick();
    const finished = await job(quote.id);
    expect(finished.status).toBe('completed');
    expect(finished.result.title).toBe(candidates[1].title);
    expect(finished.result.historyIds).toEqual([previous.id]);
    const [post] = await db.query('SELECT * FROM posts WHERE id=$1', [finished.postId]);
    expect(post).toMatchObject({ status: 'draft', publishStatus: null, approvedAt: null, brief: '' });
    expect((await marketing.jobs(WORKSPACE_ID, 'mellow'))[0].title).toBe(candidates[1].title);
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it('stops before paid media when every candidate repeats existing content', async () => {
    for (const candidate of candidates) await draft('mellow', candidate);
    const quote = await enqueue('', 'image');
    const fake = vi.fn(async () => completion());
    vi.stubGlobal('fetch', fake);
    const worker = new MarketingWorker(db);
    await worker.tick();
    await worker.tick();
    expect(await job(quote.id)).toMatchObject({ status: 'failed', postId: null });
    expect((await job(quote.id)).error).toContain('다른 소재');
    expect(fake).toHaveBeenCalledTimes(1);
    expect(String(fake.mock.calls[0][0])).toContain('api.openai.com');
  });
  it('reserves different ideas for concurrent workers even if both planned from empty history', async () => {
    const a = await enqueue('첫 요청'),
      b = await enqueue('두 번째 요청');
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (++calls === 2) release();
        await bothStarted;
        return completion();
      }),
    );
    await Promise.all([new MarketingWorker(db).tick(), new MarketingWorker(db).tick()]);
    const jobs = await Promise.all([job(a.id), job(b.id)]);
    expect(jobs.map((j) => j.status)).toEqual(['completed', 'completed']);
    expect(new Set(jobs.map((j) => j.result.title)).size).toBe(2);
    expect(calls).toBe(2);
  });
  it('compares normalized copy and idea descriptors, but permits a new angle on the same feature', () => {
    expect(
      isRepeatedContent(
        { ...candidates[0], caption: `${candidates[0].caption} #mellow\nAI로 제작한 이미지·영상입니다.` },
        { ...candidates[0], topic: undefined },
      ),
    ).toBe(true);
    expect(
      isRepeatedContent(
        { ...candidates[0], caption: '완전히 다른 문장으로 바꿔도 같은 소재예요.' },
        candidates[0],
      ),
    ).toBe(true);
    expect(isRepeatedContent(candidates[1], candidates[0])).toBe(false);
    expect(isRepeatedContent({ ...candidates[1], topic: candidates[0].topic }, candidates[0])).toBe(false);
  });
  it('bounds memory, prioritizes published posts and isolates workspaces', async () => {
    const p = await store.project(WORKSPACE_ID, 'mellow');
    const published = await draft('mellow', { ...candidates[0], caption: '가'.repeat(1900) });
    await db.query(
      `UPDATE posts SET "publishStatus"='published',"updatedAt"=now()-interval '1 year' WHERE id=$1`,
      [published.id],
    );
    for (let i = 0; i < 24; i++)
      await draft('mellow', { ...candidates[1], caption: '나'.repeat(1900), title: `초안 ${i}` });
    const history = await contentHistory(db.manager, WORKSPACE_ID, p.id);
    expect(history[0].id).toBe(published.id);
    expect(Buffer.byteLength(JSON.stringify(history))).toBeLessThanOrEqual(HISTORY_BYTES);
    expect(history.length).toBeLessThan(21);
    expect(await contentHistory(db.manager, WORKSPACE_ID, p.id, undefined, Infinity)).toHaveLength(21);
    expect(await contentHistory(db.manager, randomUUID(), p.id)).toEqual([]);
  });
  it('keeps already queued legacy jobs within their original planning budget', async () => {
    const quote = await enqueue('기존 요청');
    await db.query(`UPDATE generation_jobs SET snapshot=snapshot-'plannerVersion' WHERE id=$1`, [quote.id]);
    const fake = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      expect(request.max_completion_tokens).toBe(1800);
      expect(JSON.parse(request.messages[1].content)).not.toHaveProperty('contentHistory');
      return json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                title: '이전 기획',
                caption: 'AI 친구와 이야기해요.',
                mediaPrompt: '',
              }),
            },
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fake);
    await new MarketingWorker(db).tick();
    expect((await job(quote.id)).status).toBe('completed');
    expect(fake).toHaveBeenCalledTimes(1);
  });
});
