import { afterEach, expect, it, vi } from 'vitest';
import { planContent } from '../packages/database/src/marketing-providers';

const project = {
  id: 'p',
  slug: 'demo',
  name: 'Demo',
  description: 'A demo app',
  audience: 'Learners',
  facts: 'Calls you at a set time',
  tone: 'Friendly',
  avoid: '',
  website: 'https://example.invalid/',
  color: '#000000',
  revision: 1,
  profileReviewedAt: null,
  guide: {},
} as any;
const long = '가'.repeat(400);
const candidate = (i: number) => ({
  title: `제목 ${i}`,
  caption: '아침 7시에 친구가 전화해요.',
  mediaPrompt: 'A bedroom at dawn, a phone rings.',
  topic: `주제 ${i}`,
  angle: 'real-use',
  keyMessage: '기억하는 친구',
  visualConcept: long,
  pillar: '',
  headline: [],
  subline: '',
});
afterEach(() => vi.unstubAllGlobals());

it('trims over-long history descriptors instead of failing the paid run', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: JSON.stringify({ candidates: [0, 1, 2].map(candidate) }) },
              },
            ],
          }),
        ),
    ),
  );
  const { candidates } = await planContent(
    { openaiKey: 'test-not-real' },
    'gpt-4o-mini',
    project,
    { prompt: '', format: 'video', channel: 'instagram', language: 'ko' },
    [],
  );
  expect(candidates).toHaveLength(3);
  for (const c of candidates) expect(c.visualConcept).toHaveLength(160);
});

it('drops a malformed candidate and names the problem when none remain', async () => {
  const reply = (cands: unknown[]) =>
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: cands }) } }],
          }),
        ),
    );
  const input = {
    prompt: '',
    format: 'video' as const,
    channel: 'instagram' as const,
    language: 'ko' as const,
  };
  vi.stubGlobal('fetch', reply([{ ...candidate(0), mediaPrompt: '' }, candidate(1), candidate(2)]));
  const { candidates } = await planContent({ openaiKey: 'test-not-real' }, 'gpt-4o-mini', project, input, []);
  expect(candidates.map((c) => c.title)).toEqual(['제목 1', '제목 2']);
  vi.stubGlobal('fetch', reply([0, 1, 2].map((i) => ({ ...candidate(i), mediaPrompt: '' }))));
  await expect(
    planContent({ openaiKey: 'test-not-real' }, 'gpt-4o-mini', project, input, []),
  ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('미디어 지시 없음') });
});

it('derives an empty media visual descriptor from the media prompt', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify({
                    candidates: [0, 1, 2].map((i) => ({ ...candidate(i), visualConcept: '' })),
                  }),
                },
              },
            ],
          }),
        ),
    ),
  );
  const { candidates } = await planContent(
    { openaiKey: 'test-not-real' },
    'gpt-4o-mini',
    project,
    { prompt: '', format: 'video', channel: 'instagram', language: 'ko' },
    [],
  );
  expect(candidates[0]!.visualConcept).toBe('A bedroom at dawn, a phone rings.');
});
