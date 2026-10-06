import { afterEach, expect, it, vi } from 'vitest';

// Google hosts resolve to public addresses; tests never touch the network.
vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '142.250.1.1', family: 4 }] }));

const { renderMedia, mediaStatus, mediaSource, MEDIA_MODELS, VIDEO_SECONDS } =
  await import('../packages/database/src/marketing-providers');
const { downloadMedia } = await import('../packages/database/src/marketing-security');

const c = { geminiKey: 'gemini-test-not-real' };
const OP = `models/${MEDIA_MODELS.video}/operations/op123`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 16]), Buffer.from('ftypisom'), Buffer.alloc(40)]);
afterEach(() => vi.unstubAllGlobals());

it('submits a 9:16 Veo request with the key header and returns the operation name', async () => {
  const fetch = vi.fn(async () => json({ name: OP }));
  vi.stubGlobal('fetch', fetch);
  expect(await renderMedia(c, 'video', 'A rainy street at dusk')).toEqual({ request_id: OP });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(
    `https://generativelanguage.googleapis.com/v1beta/models/${MEDIA_MODELS.video}:predictLongRunning`,
  );
  expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(c.geminiKey);
  expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  expect(JSON.parse(String(init.body))).toEqual({
    instances: [{ prompt: 'A rainy street at dusk' }],
    parameters: { aspectRatio: '9:16', resolution: '720p', durationSeconds: VIDEO_SECONDS },
  });
});

it('treats an unidentifiable submission as uncertain so it is never paid twice', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ name: 'https://evil.test/op' })),
  );
  await expect(renderMedia(c, 'video', 'x')).rejects.toMatchObject({ uncertain: true });
});

it('normalizes operation states, including safety-filtered results', async () => {
  const replies = [
    { name: OP, done: false },
    { name: OP, done: true, error: { code: 3, message: 'bad' } },
    { name: OP, done: true, response: { generateVideoResponse: { raiMediaFilteredCount: 1 } } },
    {
      name: OP,
      done: true,
      response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://g/v' } }] } },
    },
  ];
  const fetch = vi.fn(async () => json(replies.shift()));
  vi.stubGlobal('fetch', fetch);
  expect(await mediaStatus(c, OP)).toEqual({ status: 'in_progress' });
  expect(await mediaStatus(c, OP)).toEqual({ status: 'failed' });
  expect(await mediaStatus(c, OP)).toEqual({ status: 'nsfw' });
  expect(await mediaStatus(c, OP)).toEqual({ status: 'completed', video: { url: 'https://g/v' } });
  expect(fetch.mock.calls[0]![0]).toBe(`https://generativelanguage.googleapis.com/v1beta/${OP}`);
});

it('keeps polling Higgsfield ids on the Higgsfield status endpoint', async () => {
  const fetch = vi.fn(async () => json({ status: 'queued' }));
  vi.stubGlobal('fetch', fetch);
  await mediaStatus({ higgsfieldKey: 'k', higgsfieldSecret: 's' }, 'legacy-request');
  expect(fetch.mock.calls[0]![0]).toBe('https://api.higgsfield.ai/requests/legacy-request/status');
});

it('downloads the video with the key only on the API host and follows Google storage redirects', async () => {
  const fetch = vi.fn(async (url: URL) =>
    url.hostname === 'generativelanguage.googleapis.com'
      ? new Response(null, { status: 302, headers: { location: 'https://storage.googleapis.com/b/v.mp4' } })
      : new Response(mp4),
  );
  vi.stubGlobal('fetch', fetch);
  const asset = await downloadMedia(
    'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media',
    mediaSource(c, OP),
  );
  expect(asset.mime).toBe('video/mp4');
  const headers = fetch.mock.calls.map(([, init]: any) => init.headers);
  expect(headers[0]['x-goog-api-key']).toBe(c.geminiKey);
  expect(headers[1]['x-goog-api-key']).toBeUndefined();
});

it('refuses non-Google hosts for Veo results', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(downloadMedia('https://evil.test/v.mp4', mediaSource(c, OP))).rejects.toMatchObject({
    status: 400,
  });
  await expect(
    downloadMedia('https://googleusercontent.com.evil.test/v.mp4', mediaSource(c, OP)),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetch).not.toHaveBeenCalled();
});
