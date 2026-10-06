import { z } from 'zod';

export const channelSchema = z.enum(['x', 'threads', 'instagram']);
/** Content and account languages. A product connects one account per channel and language. */
export const LANGUAGES = ['ko', 'en', 'ja', 'zh', 'es'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;
export const LANGUAGE_LABELS: Record<Language, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  zh: '중국어',
  es: '스페인어',
};
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_VIDEO_BYTES = 15 * 1024 * 1024;
export const MAX_POST_POSTER_BYTES = 1024 * 1024;
/** Length of an automatically generated video clip (Veo supports 4, 6 or 8 seconds). */
export const GENERATED_VIDEO_SECONDS = 8;
export const POST_BODY_LIMIT = 21 * 1024 * 1024;
/** Manual attachment as a data URL: PNG/JPEG up to 5 MB or MP4 up to 15 MB. */
export const MEDIA_DATA_URL = /^data:(image\/(png|jpeg)|video\/mp4);base64,[A-Za-z0-9+/]+={0,2}$/;
export const postInput = z
  .object({
    title: z.string().trim().min(1, '제목을 입력해 주세요.').max(120),
    caption: z.string().max(5000),
    brief: z.string().max(1200),
    channel: channelSchema,
    language: languageSchema,
    image: z
      .string()
      .max(Math.ceil(MAX_POST_VIDEO_BYTES / 3) * 4 + 'data:video/mp4;base64,'.length)
      .regex(MEDIA_DATA_URL)
      .optional(),
    /** Optional first-frame JPEG/PNG for a video attachment, captured in the browser. */
    poster: z
      .string()
      .max(Math.ceil(MAX_POST_POSTER_BYTES / 3) * 4 + 'data:image/jpeg;base64,'.length)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/)
      .optional(),
  })
  .strict();
export const postUpdate = postInput.extend({ revision: z.number().int().positive() });
export const revisionInput = z.object({ revision: z.number().int().positive() }).strict();
/** Records a post that the operator published outside the console (web UI, app), so the console stops treating it as unpublished. */
export const externalPublication = z
  .object({
    revision: z.number().int().positive(),
    url: z
      .string()
      .url()
      .max(500)
      .refine(
        (u) => /^https:\/\/(www\.)?(instagram\.com|threads\.(com|net)|x\.com|twitter\.com)\//.test(u),
        '게시물 주소는 Instagram·Threads·X 링크여야 합니다.',
      ),
  })
  .strict();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 형식의 색을 입력해 주세요.');
export const TEMPLATE_KINDS = ['none', 'photo-headline', 'color-card'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
/**
 * Per-product content guide. Everything product-specific about content quality lives here as data;
 * planning, review and rendering code is shared by every product.
 */
export const contentGuide = z
  .object({
    pillars: z
      .array(z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(400) }).strict())
      .max(6)
      .default([]),
    examples: z
      .array(
        z
          .object({
            channel: channelSchema.optional(),
            text: z.string().trim().min(1).max(1900),
            note: z.string().max(300).default(''),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    counterExamples: z
      .array(z.object({ text: z.string().trim().min(1).max(1900), reason: z.string().max(300) }).strict())
      .max(10)
      .default([]),
    bannedPhrases: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
    requireWebsite: z.boolean().default(false),
    hashtags: z
      .object({
        fixed: z.array(z.string().regex(/^#[\p{L}\p{N}_]{1,40}$/u, '해시태그는 #으로 시작해 주세요.')).max(5),
        max: z.number().int().min(0).max(10),
      })
      .strict()
      .default({ fixed: [], max: 3 }),
    visual: z
      .object({
        photoStyle: z.string().max(1200).default(''),
        template: z.enum(TEMPLATE_KINDS).default('none'),
        palette: z
          .object({ background: hexColor, ink: hexColor, accent: hexColor })
          .strict()
          .default({ background: '#212620', ink: '#F9F9F9', accent: '#C6ED82' }),
        tagline: z.string().max(60).default(''),
        logoAssetId: z.uuid().nullable().default(null),
      })
      .strict()
      .default({
        photoStyle: '',
        template: 'none',
        palette: { background: '#212620', ink: '#F9F9F9', accent: '#C6ED82' },
        tagline: '',
        logoAssetId: null,
      }),
  })
  .strict();
export type ContentGuide = z.infer<typeof contentGuide>;
export const emptyGuide = (): ContentGuide => contentGuide.parse({});
export const GUIDE_LOGO_BYTES = 1024 * 1024;
export const guideLogoInput = z
  .object({
    image: z
      .string()
      .max(Math.ceil(GUIDE_LOGO_BYTES / 3) * 4 + 'data:image/jpeg;base64,'.length)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
/** Headline lines for a template render; the second line takes the accent color. */
export const templateRenderInput = z
  .object({
    revision: z.number().int().positive(),
    kind: z.enum(['photo-headline', 'color-card']),
    headline: z.array(z.string().trim().min(1).max(24)).min(1).max(2),
    subline: z.string().max(60).default(''),
  })
  .strict();
export type TemplateRenderInput = z.infer<typeof templateRenderInput>;
export const profileInput = z
  .object({
    revision: z.number().int().positive(),
    description: z.string().trim().min(1).max(1000),
    audience: z.string().max(1000),
    facts: z.string().max(5000),
    tone: z.string().max(1000),
    avoid: z.string().max(2000),
    website: z.union([
      z.literal(''),
      z.url().refine((s) => s.startsWith('https://'), 'HTTPS 주소를 입력해 주세요.'),
    ]),
    guide: contentGuide.optional(),
  })
  .strict();
export type Channel = z.infer<typeof channelSchema>;
export type PostInput = z.infer<typeof postInput>;
export type ProfileInput = z.infer<typeof profileInput>;
export type PostStatus = 'draft' | 'approved';
export interface Project {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string;
  audience: string;
  facts: string;
  tone: string;
  avoid: string;
  website: string;
  guide: ContentGuide;
  revision: number;
  profileReviewedAt: string | null;
}
export interface Post extends Omit<PostInput, 'image' | 'poster'> {
  format?: 'text' | 'image' | 'video';
  assetId?: string | null;
  posterAssetId?: string | null;
  sourceAssetId?: string | null;
  publishStatus?:
    'queued' | 'creating' | 'processing' | 'submitting' | 'published' | 'failed' | 'uncertain' | null;
  publishError?: string | null;
  publishedUrl?: string | null;
  id: string;
  projectId: string;
  status: PostStatus;
  revision: number;
  profileRevision: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Activity {
  id: string;
  projectId: string;
  action: string;
  title: string;
  createdAt: string;
}
export interface Dashboard {
  projects: Project[];
  posts: Post[];
  activities: Activity[];
  mode: 'local' | 'production';
  user: { name: string; email: string };
}
export interface AuthOptions {
  local: boolean;
  google: boolean;
}
export const CHANNEL_LABELS: Record<Channel, string> = { x: 'X', threads: 'Threads', instagram: 'Instagram' };
export const STATUS_LABELS: Record<PostStatus, string> = { draft: '초안', approved: '승인됨' };

export const secretFields = [
  'openaiKey',
  'higgsfieldKey',
  'higgsfieldSecret',
  'geminiKey',
  'bufferApiKey',
  'xClientId',
  'xClientSecret',
  'instagramClientId',
  'instagramClientSecret',
  'threadsClientId',
  'threadsClientSecret',
] as const;
export type SecretField = (typeof secretFields)[number];
const secret = z.string().trim().min(1).max(4096);
const price = z.number().finite().positive().max(10000).nullable();
export const integrationInput = z
  .object({
    revision: z.number().int().nonnegative(),
    openaiModel: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{1,100}$/),
    openaiInputUsd: price,
    openaiOutputUsd: price,
    imageUsd: price,
    videoUsd: price,
    secrets: z
      .object({
        openaiKey: secret.optional(),
        higgsfieldKey: secret.optional(),
        higgsfieldSecret: secret.optional(),
        geminiKey: secret.optional(),
        bufferApiKey: secret.optional(),
        xClientId: secret.optional(),
        xClientSecret: secret.optional(),
        instagramClientId: secret.optional(),
        instagramClientSecret: secret.optional(),
        threadsClientId: secret.optional(),
        threadsClientSecret: secret.optional(),
      })
      .strict(),
    clear: z.array(z.enum(secretFields)).max(secretFields.length),
  })
  .strict()
  .refine((v) => !v.clear.some((k) => v.secrets[k]), '저장과 삭제를 동시에 할 수 없습니다.');
export type IntegrationInput = z.infer<typeof integrationInput>;
export interface Integrations extends Omit<IntegrationInput, 'secrets' | 'clear'> {
  configured: Record<SecretField, boolean>;
  encryptionReady: boolean;
  updatedAt: string | null;
}
const accountLanguage = languageSchema.default('ko');
export const connectionInput = z
  .object({ revision: z.number().int().nonnegative(), token: secret, language: accountLanguage })
  .strict();
export const connectionRevision = z
  .object({ revision: z.number().int().nonnegative(), language: accountLanguage })
  .strict();
export type ConnectionProvider = 'direct' | 'buffer';
export interface Connection {
  channel: Channel;
  language: Language;
  provider: ConnectionProvider;
  revision: number;
  username: string | null;
  userId: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  connected: boolean;
}
export interface BufferChannel {
  id: string;
  name: string;
  service: Channel;
  organizationName: string;
  externalLink: string | null;
}
export const bufferConnectionInput = z
  .object({
    revision: z.number().int().nonnegative(),
    language: accountLanguage,
    channelId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/),
  })
  .strict();
export const formatSchema = z.enum(['text', 'image', 'video']);
export type ContentFormat = z.infer<typeof formatSchema>;
export const generationInput = z
  .object({
    prompt: z.string().trim().max(1200).default(''),
    format: formatSchema,
    channel: channelSchema.optional(),
    language: languageSchema.default('ko'),
    reference: z.string().max(3_000_000).optional(),
  })
  .strict()
  .transform((v) => ({
    ...v,
    channel: v.channel ?? (v.format === 'text' ? ('threads' as const) : ('instagram' as const)),
  }))
  .refine(
    (v) => !(v.format === 'text' && v.channel === 'instagram'),
    'Instagram은 이미지 또는 영상을 선택해 주세요.',
  );
export type GenerationInput = z.infer<typeof generationInput>;
export interface GenerationQuote {
  id: string;
  totalUsd: number;
  lines: { label: string; usd: number }[];
  expiresAt: string;
  model: string;
  format: ContentFormat;
}
export const generationConfirm = z.object({ quoteId: z.uuid(), confirmed: z.literal(true) }).strict();
export const publishConfirm = z
  .object({
    revision: z.number().int().positive(),
    connectionRevision: z.number().int().nonnegative(),
    confirmed: z.literal(true),
  })
  .strict();
export interface GenerationJob {
  id: string;
  projectId: string;
  prompt: string;
  title: string | null;
  format: ContentFormat;
  channel: Channel;
  status:
    'quoted' | 'queued' | 'planning' | 'submitting' | 'rendering' | 'completed' | 'failed' | 'uncertain';
  error: string | null;
  postId: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedUsd: number;
}
