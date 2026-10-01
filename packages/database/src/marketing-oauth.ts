import { createHash } from 'node:crypto';
import { CHANNEL_LABELS, type Channel, type SecretField } from '@nullge/contracts';
import { providerJson, X_SCOPES, type Credentials } from './marketing-providers';
import { StoreError } from './store';

export type MetaChannel = Exclude<Channel, 'x'>;
export const oauthKeys: Record<Channel, readonly [SecretField, SecretField]> = {
  x: ['xClientId', 'xClientSecret'],
  instagram: ['instagramClientId', 'instagramClientSecret'],
  threads: ['threadsClientId', 'threadsClientSecret'],
};
export const metaScopes = {
  instagram: ['instagram_business_basic', 'instagram_business_content_publish'],
  threads: ['threads_basic', 'threads_content_publish'],
};
export function oauthApp(channel: Channel, c: Credentials) {
  const [id, secret] = oauthKeys[channel];
  if (!c[id] || !c[secret])
    throw new StoreError(400, `공통 설정에서 ${CHANNEL_LABELS[channel]} 앱을 먼저 등록해 주세요.`);
  return { clientId: c[id]!, clientSecret: c[secret]! };
}
// Preserve pending X flows from the previous deployment; separate providers' states.
export const oauthHash = (channel: Channel, state: string) =>
  createHash('sha256')
    .update(channel === 'x' ? state : `${channel}:${state}`)
    .digest('hex');

export function authorizeUrl(
  channel: Channel,
  c: Credentials,
  redirectUri: string,
  state: string,
  verifier: string,
) {
  const { clientId } = oauthApp(channel, c);
  const url = new URL(
    channel === 'x'
      ? 'https://x.com/i/oauth2/authorize'
      : channel === 'instagram'
        ? 'https://www.instagram.com/oauth/authorize'
        : 'https://www.threads.net/oauth/authorize',
  );
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: channel === 'x' ? X_SCOPES.join(' ') : metaScopes[channel].join(','),
    ...(channel === 'x'
      ? {
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          code_challenge_method: 'S256',
        }
      : {}),
    ...(channel === 'instagram' ? { enable_fb_login: '0', force_authentication: '1' } : {}),
  }).toString();
  return url.toString();
}

export interface SocialTokens {
  token: string;
  refreshToken?: string;
  expiresAt?: Date;
  longLived?: boolean;
  issuedAt?: number;
}
const metaHost = (channel: MetaChannel) =>
  channel === 'instagram' ? 'https://graph.instagram.com' : 'https://graph.threads.net';
function longLived(raw: any): SocialTokens {
  if (
    typeof raw?.access_token !== 'string' ||
    !raw.access_token ||
    raw.access_token.length > 4096 ||
    !Number.isFinite(raw.expires_in) ||
    raw.expires_in <= 60 ||
    raw.expires_in > 366 * 86400
  )
    throw new StoreError(502, 'SNS 인증 유효기간을 확인하지 못했습니다. 다시 연결해 주세요.');
  return {
    token: raw.access_token,
    expiresAt: new Date(Date.now() + raw.expires_in * 1000),
    longLived: true,
    issuedAt: Date.now(),
  };
}
export async function metaTokens(channel: MetaChannel, c: Credentials, code: string, redirectUri: string) {
  const { clientId, clientSecret } = oauthApp(channel, c);
  const raw = await providerJson<any>(
    channel === 'instagram'
      ? 'https://api.instagram.com/oauth/access_token'
      : `${metaHost(channel)}/oauth/access_token`,
    '',
    'POST',
    {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    },
    true,
  );
  // Instagram Login may wrap its exchange response in data; Threads returns it directly.
  const short = Array.isArray(raw?.data) ? raw.data[0] : raw;
  if (typeof short?.access_token !== 'string' || !short.access_token || short.access_token.length > 4096)
    throw new StoreError(502, 'SNS 인증 토큰을 확인하지 못했습니다. 다시 연결해 주세요.');
  const url = new URL(`${metaHost(channel)}/access_token`);
  url.search = new URLSearchParams({
    grant_type: channel === 'instagram' ? 'ig_exchange_token' : 'th_exchange_token',
    client_secret: clientSecret,
    access_token: short.access_token,
  }).toString();
  // Meta requires the secret in this server-to-server exchange. Never log the URL.
  return longLived(await providerJson(url.toString(), `Bearer ${short.access_token}`));
}
export async function refreshMetaTokens(channel: MetaChannel, token: string) {
  const url = new URL(`${metaHost(channel)}/refresh_access_token`);
  url.search = new URLSearchParams({
    grant_type: channel === 'instagram' ? 'ig_refresh_token' : 'th_refresh_token',
    access_token: token,
  }).toString();
  return longLived(await providerJson(url.toString(), `Bearer ${token}`));
}
