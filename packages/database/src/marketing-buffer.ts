import type { BufferChannel, Channel, ContentFormat } from '@nullge/contracts';
import { ProviderError } from './marketing-providers';
import { StoreError } from './store';

type GraphqlResponse<T> = { data?: T; errors?: { message?: string }[] };

const serviceMap: Record<string, Channel | undefined> = {
  twitter: 'x',
  threads: 'threads',
  instagram: 'instagram',
};

async function request<T>(apiKey: string, query: string, variables: object, mutation = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch('https://api.buffer.com', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ProviderError(mutation, 0);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProviderError(mutation && response.status >= 500, response.status);
  }
  let body: GraphqlResponse<T>;
  try {
    body = (await response.json()) as GraphqlResponse<T>;
  } catch {
    throw new ProviderError(mutation);
  }
  if (!body.data || body.errors?.length) {
    if (mutation) throw new ProviderError(true);
    throw new StoreError(400, 'Buffer API 키와 채널 접근 권한을 확인해 주세요.');
  }
  return body.data;
}

type RawChannel = {
  id: string;
  name: string;
  displayName?: string | null;
  service: string;
  isDisconnected: boolean;
  isLocked: boolean;
  externalLink?: string | null;
};

function normalize(raw: RawChannel, organizationName: string): BufferChannel | null {
  const service = serviceMap[raw.service];
  if (!service || !raw.id || raw.isDisconnected || raw.isLocked) return null;
  return {
    id: raw.id,
    name: raw.displayName || raw.name,
    service,
    organizationName,
    externalLink: raw.externalLink || null,
  };
}

export async function listBufferChannels(apiKey: string): Promise<BufferChannel[]> {
  const account = await request<{ account: { organizations: { id: string; name: string }[] } }>(
    apiKey,
    `query BufferOrganizations { account { organizations { id name } } }`,
    {},
  );
  const groups = await Promise.all(
    account.account.organizations.map(async (organization) => {
      const data = await request<{ channels: RawChannel[] }>(
        apiKey,
        `query BufferChannels($input: ChannelsInput!) {
        channels(input: $input) { id name displayName service isDisconnected isLocked externalLink }
      }`,
        { input: { organizationId: organization.id, filter: { product: 'publish' } } },
      );
      return data.channels
        .map((channel) => normalize(channel, organization.name))
        .filter((channel): channel is BufferChannel => !!channel);
    }),
  );
  return groups.flat().sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));
}

export async function getBufferChannel(apiKey: string, channelId: string): Promise<BufferChannel> {
  const data = await request<{ channel: RawChannel & { organizationId: string } }>(
    apiKey,
    `query BufferChannel($input: ChannelInput!) {
      channel(input: $input) { id name displayName service isDisconnected isLocked externalLink organizationId }
    }`,
    { input: { id: channelId } },
  );
  const channel = normalize(data.channel, data.channel.organizationId);
  if (!channel) throw new StoreError(400, '사용 가능한 Buffer 채널이 아닙니다.');
  return channel;
}

export async function createBufferPost(
  apiKey: string,
  input: {
    channelId: string;
    channel: Channel;
    text: string;
    format: ContentFormat;
    mediaUrl?: string;
    aiGenerated?: boolean;
  },
) {
  const assets = input.mediaUrl
    ? [{ [input.format === 'video' ? 'video' : 'image']: { url: input.mediaUrl } }]
    : [];
  const metadata =
    input.channel === 'instagram'
      ? {
          instagram: {
            type: input.format === 'video' ? 'reel' : 'post',
            shouldShareToFeed: true,
            isAiGenerated: input.aiGenerated ?? true,
          },
        }
      : undefined;
  const data = await request<{
    createPost: { post?: { id?: string; status?: string; externalLink?: string | null }; message?: string };
  }>(
    apiKey,
    `mutation CreateBufferPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id status externalLink } }
        ... on MutationError { message }
      }
    }`,
    {
      input: {
        text: input.text,
        channelId: input.channelId,
        schedulingType: 'automatic',
        mode: 'shareNow',
        needsApproval: false,
        saveToDraft: false,
        aiAssisted: true,
        source: 'nullge',
        assets,
        ...(metadata ? { metadata } : {}),
      },
    },
    true,
  );
  if (!data.createPost.post?.id) {
    // Buffer's own reason (queue limit, media rules, channel state) is what the operator needs to act on.
    const reason = data.createPost.message?.trim().slice(0, 300);
    throw new StoreError(
      400,
      `Buffer가 게시 요청을 받지 않았습니다${reason ? `: ${reason}` : '. 채널 상태와 콘텐츠 형식을 확인해 주세요.'}`,
    );
  }
  return data.createPost.post as { id: string; status: string; externalLink?: string | null };
}

export async function bufferPost(apiKey: string, id: string) {
  const data = await request<{ post: { id: string; status: string; externalLink?: string | null } }>(
    apiKey,
    `query BufferPost($input: PostInput!) { post(input: $input) { id status externalLink } }`,
    { input: { id } },
  );
  return data.post;
}
