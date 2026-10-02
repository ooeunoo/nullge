import { type GenerationJob, type SecretField } from '@nullge/contracts';

export async function call<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : method,
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || '요청을 완료하지 못했어요.');
  return data;
}

export const message = (e: unknown) => (e instanceof Error ? e.message : '요청을 완료하지 못했어요.');

export const secretLabels: Record<SecretField, string> = {
  openaiKey: 'OpenAI API Key',
  higgsfieldKey: 'Higgsfield Key ID',
  higgsfieldSecret: 'Higgsfield Key Secret',
  geminiKey: 'Gemini API Key',
  bufferApiKey: 'Buffer API Key',
  xClientId: 'X OAuth Client ID',
  xClientSecret: 'X OAuth Client Secret',
  instagramClientId: 'Instagram App ID',
  instagramClientSecret: 'Instagram App Secret',
  threadsClientId: 'Threads App ID',
  threadsClientSecret: 'Threads App Secret',
};

export const money = (v: number) => `US$ ${v.toFixed(4)}`;

export const jobLabels: Record<GenerationJob['status'], string> = {
  quoted: '비용 확인',
  queued: '대기 중',
  planning: '문구 작성 중',
  submitting: '미디어 요청 중',
  rendering: '미디어 생성 중',
  completed: '완성 · 검토 필요',
  failed: '생성 중단',
  uncertain: '처리 여부 확인 필요',
};
