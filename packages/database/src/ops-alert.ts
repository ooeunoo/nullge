/**
 * Operations alerts to the shared Telegram room "인프라_크레딧_알림". Disabled unless TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set. Sending never throws, so an alert can never fail the work that triggered it.
 */
const sentAt = new Map<string, number>();
const QUIET_MS = 60 * 60 * 1000;

export async function opsAlert(key: string, text: string, now = Date.now()) {
  const token = process.env.TELEGRAM_BOT_TOKEN,
    chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const last = sentAt.get(key);
  if (last !== undefined && now - last < QUIET_MS) return false;
  sentAt.set(key, now);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 1000), disable_web_page_preview: true }),
    });
    await r.body?.cancel().catch(() => undefined);
    return r.ok;
  } catch {
    return false;
  }
}

const PROVIDERS: Record<string, string> = {
  'api.openai.com': 'OpenAI',
  'generativelanguage.googleapis.com': 'Gemini',
  'api.higgsfield.ai': 'Higgsfield',
};
/**
 * Classifies a failed provider response as a money problem (no credit, quota or billing) worth an immediate alert.
 * Plain rate limits are not alerted.
 */
export function creditProblem(host: string, status: number, message: string) {
  const provider = PROVIDERS[host];
  if (!provider) return null;
  const m = message.toLowerCase();
  const money =
    /insufficient_quota|exceeded your current quota|billing|credit|balance|prepay|payment|spending cap|limit: 0\b/.test(
      m,
    ) ||
    (status === 402 && provider === 'Higgsfield');
  return money ? provider : null;
}

export function alertCreditProblem(host: string, status: number, message: string) {
  const provider = creditProblem(host, status, message);
  if (!provider) return;
  void opsAlert(
    `credit:${provider}`,
    `🚨 Nullge Console · ${provider} 크레딧·결제 문제로 요청이 거절됐어요 (${status}).\n${message.slice(0, 200)}\n자동 생성이 멈춰 있어요. 잔액·결제 수단을 확인해 주세요.`,
  );
}
