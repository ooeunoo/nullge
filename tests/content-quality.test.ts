import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  database,
  seedDevelopment,
  Store,
  MarketingStore,
  MarketingWorker,
  WORKSPACE_ID,
} from '@nullge/database';
import { contentGuide, emptyGuide, generationInput, type ContentGuide } from '@nullge/contracts';
import { guideViolations, withFixedHashtags } from '../packages/database/src/content-checks';
import { renderTemplate, RENDER_HEIGHT, RENDER_WIDTH } from '../packages/database/src/content-render';
import { planInstructions } from '../packages/database/src/marketing-providers';
import { currentProductCatalog } from '../packages/database/src/minimo-desktop-pet';
import { withReview } from './helpers/openai-review';

const adminUrl = process.env.NULLGE_TEST_DATABASE_ADMIN_URL || 'postgres://nullge@127.0.0.1:5549/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(adminUrl).hostname)) throw Error('Local tests only');
const name = `nullge_test_${randomUUID().replaceAll('-', '')}`,
  url = new URL(adminUrl);
url.pathname = `/${name}`;
const admin = database(adminUrl),
  db = database(url.toString()),
  store = new Store(db),
  marketing = new MarketingStore(db),
  actor = randomUUID();
let created = false;

const guide = (patch: Partial<ContentGuide> = {}): ContentGuide => ({ ...emptyGuide(), ...patch });
const candidate = (title: string, caption: string, extra = {}) => ({
  title,
  caption,
  mediaPrompt: '',
  topic: `${title} 주제`,
  angle: `${title} 관점`,
  keyMessage: `${title} 메시지`,
  visualConcept: '',
  pillar: '',
  headline: [],
  subline: '',
  ...extra,
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const planned = (items: unknown[]) =>
  json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: items }) } }] });
const photo = () =>
  sharp({ create: { width: 900, height: 1200, channels: 3, background: '#557755' } })
    .jpeg()
    .toBuffer();
async function saveGuide(slug: string, g: ContentGuide) {
  const p = await store.project(WORKSPACE_ID, slug);
  return store.updateProfile(WORKSPACE_ID, slug, actor, {
    revision: p.revision,
    description: p.description,
    audience: p.audience,
    facts: p.facts,
    tone: p.tone,
    avoid: p.avoid,
    website: p.website,
    guide: g,
  });
}

beforeAll(async () => {
  vi.stubEnv('MARKETING_SECRET_KEY', 'cd'.repeat(32));
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await db.initialize();
  await db.runMigrations();
  await seedDevelopment(db);
  await db.query('INSERT INTO operators (id,email,name) VALUES ($1,$2,$3)', [
    actor,
    'quality@test.invalid',
    'T',
  ]);
  const settings = await marketing.settings(WORKSPACE_ID);
  await marketing.saveSettings(WORKSPACE_ID, actor, {
    ...settings,
    secrets: { openaiKey: 'test-not-real' },
    clear: [],
  });
}, 30000);
beforeEach(async () => {
  await db.query('TRUNCATE events,marketing_assets,publication_jobs,generation_jobs,posts CASCADE');
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

describe('content guide data', () => {
  it('reads an empty guide as complete defaults and versions a saved guide with the profile', async () => {
    const before = await store.project(WORKSPACE_ID, 'kept');
    expect(before.guide).toEqual(emptyGuide());
    const g = guide({
      pillars: [{ name: '오늘의 10분', description: '하루 순서' }],
      bannedPhrases: ['무조건'],
    });
    const next = await saveGuide('kept', g);
    expect(next.revision).toBe(before.revision + 1);
    expect(next.guide.pillars[0].name).toBe('오늘의 10분');
    const [v] = await db.query('SELECT snapshot FROM profile_versions WHERE "projectId"=$1 AND revision=$2', [
      next.id,
      next.revision,
    ]);
    expect(v.snapshot.guide.bannedPhrases).toEqual(['무조건']);
    // A save without a guide keeps the stored one.
    const kept = await store.updateProfile(WORKSPACE_ID, 'kept', actor, {
      revision: next.revision,
      description: next.description,
      audience: next.audience,
      facts: next.facts,
      tone: next.tone,
      avoid: next.avoid,
      website: next.website,
    });
    expect(kept.guide.bannedPhrases).toEqual(['무조건']);
  });
  it('rejects a logo that belongs to another product', async () => {
    const png = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#00000000' } })
      .png()
      .toBuffer();
    const { id } = await marketing.uploadGuideLogo(
      WORKSPACE_ID,
      'clipit',
      actor,
      `data:image/png;base64,${png.toString('base64')}`,
    );
    const g = guide();
    await expect(saveGuide('kept', { ...g, visual: { ...g.visual, logoAssetId: id } })).rejects.toMatchObject(
      { status: 400 },
    );
    const saved = await saveGuide('clipit', { ...g, visual: { ...g.visual, logoAssetId: id } });
    expect(saved.guide.visual.logoAssetId).toBe(id);
  });
  it('validates guide limits', () => {
    expect(contentGuide.safeParse({ pillars: Array(7).fill({ name: 'a', description: '' }) }).success).toBe(
      false,
    );
    expect(contentGuide.safeParse({ hashtags: { fixed: ['nohash'], max: 3 } }).success).toBe(false);
    expect(
      contentGuide.safeParse({
        visual: { palette: { background: 'red', ink: '#000000', accent: '#000000' } },
      }).success,
    ).toBe(false);
  });
});

describe('shared checks and prompts', () => {
  const g = guide({
    bannedPhrases: ['Best App'],
    requireWebsite: true,
    hashtags: { fixed: ['#tag'], max: 2 },
  });
  it('flags banned phrases, disclosure text, a missing website and too many hashtags', () => {
    const site = 'https://example.test/';
    expect(guideViolations({ caption: 'the best   app ever example.test' }, 'threads', g, site)).toEqual([
      '금지 문구: Best App',
    ]);
    expect(
      guideViolations({ caption: '좋아요 example.test', subline: 'AI로 제작한 이미지' }, 'threads', g, site),
    ).toContain('AI 제작 고지 문구');
    expect(guideViolations({ caption: '링크 없음' }, 'threads', g, site)).toContain('웹사이트 주소 누락');
    expect(guideViolations({ caption: 'example.test #a #b #c' }, 'threads', g, site)).toContain(
      '해시태그 개수 초과',
    );
    expect(guideViolations({ caption: 'x'.repeat(101) }, 'x', guide(), '')).toContain('채널 글자 수 초과');
  });
  it('adds fixed hashtags only within the budget', () => {
    expect(withFixedHashtags('본문', 'threads', g)).toBe('본문\n#tag');
    expect(withFixedHashtags('본문 #a #b', 'threads', g)).toBe('본문 #a #b');
    expect(withFixedHashtags('본문 #TAG', 'threads', g)).toBe('본문 #TAG');
  });
  it('adds guide sections only when the guide has content, and hook rules for planning', async () => {
    const p = await store.project(WORKSPACE_ID, 'dotori');
    const plain = planInstructions({ ...p, guide: emptyGuide() }, true);
    expect(plain).not.toContain('Content pillars');
    expect(plain).toContain('first line is the hook');
    expect(planInstructions({ ...p, guide: emptyGuide() }, false)).not.toContain('first line is the hook');
    const rich = planInstructions(
      {
        ...p,
        guide: guide({
          pillars: [{ name: '작은 오늘', description: '' }],
          visual: { ...emptyGuide().visual, template: 'photo-headline' },
        }),
      },
      true,
    );
    expect(rich).toContain('작은 오늘');
    expect(rich).toContain('composed into a poster');
  });
});

describe('generation with checks and review', () => {
  async function run(items: unknown[], opts: Parameters<typeof withReview>[1] = {}) {
    const quote = await marketing.quote(
      WORKSPACE_ID,
      'dotori',
      actor,
      generationInput.parse({ format: 'text' }),
    );
    expect(quote.lines.some((l) => l.label.includes('검수'))).toBe(true);
    await marketing.confirm(WORKSPACE_ID, 'dotori', actor, quote.id);
    const fetch = vi.fn(withReview(async () => planned(items), opts));
    vi.stubGlobal('fetch', fetch);
    await new MarketingWorker(db).tick();
    return { job: (await db.query('SELECT * FROM generation_jobs WHERE id=$1', [quote.id]))[0], fetch };
  }
  beforeAll(async () => {
    await saveGuide('dotori', guide({ bannedPhrases: ['최고의 앱'], hashtags: { fixed: [], max: 3 } }));
  });
  it('drops guide violations, then picks the best reviewed candidate', async () => {
    const { job } = await run(
      [
        candidate('금지', '최고의 앱이에요. 오늘 할 일을 정리해요.'),
        candidate('평범', '오늘 할 일 세 개만 적어 봐요. 어떤 일이 먼저인가요?'),
        candidate('후킹', '월요일 아침, 할 일이 열두 개라면? 오늘 몫은 세 개면 충분해요.'),
      ],
      { scores: [2, 5] }, // indexes follow the candidates that passed the guide check
    );
    expect(job.status).toBe('completed');
    expect(job.result.title).toBe('후킹');
    expect(job.result.review.score).toBeGreaterThan(10);
  });
  it('fails before any media when the editor rejects every candidate', async () => {
    const { job } = await run(
      [
        candidate('하나', '오늘 몫을 정해요. 무엇부터 할까요?'),
        candidate('둘', '넘어온 일을 같이 골라요. 어떻게 할까요?'),
        candidate('셋', '알림은 정한 시각에 울려요. 몇 시가 좋을까요?'),
      ],
      { reject: true },
    );
    expect(job.status).toBe('failed');
    expect(job.error).toContain('검수에서 모든 후보가 탈락');
  });
  it('fails without calling review when every candidate breaks the guide', async () => {
    const { job, fetch } = await run([
      candidate('금지1', '최고의 앱 하나'),
      candidate('금지2', '최고의 앱 둘'),
      candidate('금지3', '최고의 앱 셋'),
    ]);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('가이드 검사');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('template renderer', () => {
  const palette = { background: '#1F2A2E', ink: '#F6F1E8', accent: '#C6ED82' };
  it('renders both layouts at 1080×1350 with Korean and Latin headlines', async () => {
    for (const input of [
      {
        kind: 'photo-headline' as const,
        photo: await photo(),
        headline: ['한 줄 헤드라인', '강조되는 둘째 줄'],
      },
      { kind: 'color-card' as const, headline: ['A card', 'without a photo'] },
    ]) {
      const out = await renderTemplate({ palette, tagline: '하단 문구', subline: '보조 문장', ...input });
      const meta = await sharp(out).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', RENDER_WIDTH, RENDER_HEIGHT]);
    }
    await expect(
      renderTemplate({ kind: 'photo-headline', palette, tagline: '', subline: '', headline: ['x'] }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('applies to a draft, keeps the source photo, and re-applies without stacking', async () => {
    const image = `data:image/jpeg;base64,${(await photo()).toString('base64')}`;
    const post = await store.create(WORKSPACE_ID, 'kept', actor, {
      title: '사진 글',
      caption: '본문',
      brief: '',
      channel: 'instagram',
      language: 'ko',
      image,
    });
    const first = await marketing.applyTemplate(WORKSPACE_ID, 'kept', post.id, actor, {
      revision: post.revision,
      kind: 'photo-headline',
      headline: ['첫 줄'],
      subline: '',
    });
    expect(first.sourceAssetId).toBe(post.assetId);
    expect(first.assetId).not.toBe(post.assetId);
    const second = await marketing.applyTemplate(WORKSPACE_ID, 'kept', post.id, actor, {
      revision: first.revision,
      kind: 'photo-headline',
      headline: ['다른 줄'],
      subline: '',
    });
    expect(second.sourceAssetId).toBe(post.assetId);
    expect(await db.query('SELECT 1 FROM marketing_assets WHERE id=$1', [first.assetId])).toHaveLength(0);
    const text = await store.create(WORKSPACE_ID, 'kept', actor, {
      title: '글',
      caption: '본문',
      brief: '',
      channel: 'threads',
      language: 'ko',
    });
    const card = await marketing.applyTemplate(WORKSPACE_ID, 'kept', text.id, actor, {
      revision: text.revision,
      kind: 'color-card',
      headline: ['카드'],
      subline: '',
    });
    expect([card.format, card.sourceAssetId]).toEqual(['image', null]);
  });
});

it('keeps product names and slugs out of the shared content code', () => {
  const files = [
    'packages/database/src/content-checks.ts',
    'packages/database/src/content-render.ts',
    'packages/database/src/marketing-providers.ts',
    'packages/database/src/marketing-worker.ts',
    'apps/console/features/settings/GuideEditor.tsx',
    'apps/console/features/content/TemplatePanel.tsx',
  ];
  const names = currentProductCatalog.flatMap((p) => [p.slug, p.name]).concat(['mellow', 'minimo', 'movy']);
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').toLowerCase();
    for (const n of names) {
      const word = new RegExp(
        `(^|[^\\p{L}\\p{N}])${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`,
        'u',
      );
      expect(word.test(source), `${n} in ${file}`).toBe(false);
    }
  }
});
