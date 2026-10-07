import { afterEach, expect, it, vi } from 'vitest';
import { creditProblem, opsAlert } from '../packages/database/src/ops-alert';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('treats credit, quota and billing failures as money problems, not plain rate limits', () => {
  expect(creditProblem('api.openai.com', 429, 'insufficient_quota You exceeded your current quota')).toBe(
    'OpenAI',
  );
  expect(
    creditProblem('generativelanguage.googleapis.com', 403, 'PERMISSION_DENIED Billing account is disabled'),
  ).toBe('Gemini');
  expect(
    creditProblem(
      'generativelanguage.googleapis.com',
      429,
      'RESOURCE_EXHAUSTED Your prepayment credits are depleted',
    ),
  ).toBe('Gemini');
  expect(creditProblem('api.higgsfield.ai', 402, '')).toBe('Higgsfield');
  expect(creditProblem('api.openai.com', 429, 'rate_limit_exceeded Rate limit reached')).toBeNull();
  expect(creditProblem('graph.instagram.com', 400, 'billing')).toBeNull();
});

it('sends once per hour per key and stays silent without configuration', async () => {
  const fetch = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  expect(await opsAlert('k', 'hi', 1_000)).toBe(false);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
  vi.stubEnv('TELEGRAM_CHAT_ID', '-100');
  expect(await opsAlert('k', 'hi', 2_000)).toBe(true);
  expect(await opsAlert('k', 'again', 3_000)).toBe(false);
  expect(await opsAlert('k', 'later', 2_000 + 3_600_001)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse((fetch.mock.calls[0] as any)[1].body)).toMatchObject({ chat_id: '-100', text: 'hi' });
});

it('never throws when Telegram is unreachable', async () => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
  vi.stubEnv('TELEGRAM_CHAT_ID', '-100');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  await expect(opsAlert('x', 'hi', 10)).resolves.toBe(false);
});
