import { z } from 'zod';

export const channelSchema = z.enum(['x', 'threads', 'instagram']);
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_VIDEO_BYTES = 15 * 1024 * 1024;
export const POST_BODY_LIMIT = 21 * 1024 * 1024;
/** Manual attachment as a data URL: PNG/JPEG up to 5 MB or MP4 up to 15 MB. */
export const MEDIA_DATA_URL = /^data:(image\/(png|jpeg)|video\/mp4);base64,[A-Za-z0-9+/]+={0,2}$/;
export const postInput = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(120),
  caption: z.string().max(5000),
  brief: z.string().max(1200),
  channel: channelSchema,
  language: z.enum(['ko', 'en']),
  image: z.string().max(Math.ceil(MAX_POST_VIDEO_BYTES / 3) * 4 + 'data:video/mp4;base64,'.length).regex(MEDIA_DATA_URL).optional(),
}).strict();
export const postUpdate = postInput.extend({ revision: z.number().int().positive() });
export const revisionInput = z.object({ revision: z.number().int().positive() }).strict();
export const profileInput = z.object({
  revision: z.number().int().positive(),
  description: z.string().trim().min(1).max(1000),
  audience: z.string().max(1000),
  facts: z.string().max(5000),
  tone: z.string().max(1000),
  avoid: z.string().max(2000),
  website: z.union([z.literal(''), z.url().refine(s => s.startsWith('https://'), 'HTTPS 주소를 입력해 주세요.')]),
}).strict();
export type Channel = z.infer<typeof channelSchema>;
export type PostInput = z.infer<typeof postInput>;
export type ProfileInput = z.infer<typeof profileInput>;
export type PostStatus = 'draft' | 'review' | 'approved';
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
  revision: number;
  profileReviewedAt: string | null;
}
export interface Post extends Omit<PostInput, 'image'> {
  format?: 'text'|'image'|'video';
  assetId?: string|null;
  publishStatus?:'queued'|'creating'|'processing'|'submitting'|'published'|'failed'|'uncertain'|null;
  publishError?:string|null;
  publishedUrl?:string|null;
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
export interface AuthOptions { local: boolean; google: boolean; }
export const CHANNEL_LABELS: Record<Channel, string> = { x: 'X', threads: 'Threads', instagram: 'Instagram' };
export const STATUS_LABELS: Record<PostStatus, string> = { draft: '초안', review: '검토 대기', approved: '검토 완료' };

export const secretFields = ['openaiKey','higgsfieldKey','higgsfieldSecret','bufferApiKey','xClientId','xClientSecret','instagramClientId','instagramClientSecret','threadsClientId','threadsClientSecret'] as const;
export type SecretField = typeof secretFields[number];
const secret = z.string().trim().min(1).max(4096);
const price = z.number().finite().positive().max(10000).nullable();
export const integrationInput = z.object({
  revision:z.number().int().nonnegative(),
  openaiModel:z.string().trim().regex(/^[a-zA-Z0-9._-]{1,100}$/),
  openaiInputUsd:price, openaiOutputUsd:price, imageUsd:price, videoUsd:price,
  secrets:z.object({openaiKey:secret.optional(),higgsfieldKey:secret.optional(),higgsfieldSecret:secret.optional(),bufferApiKey:secret.optional(),xClientId:secret.optional(),xClientSecret:secret.optional(),instagramClientId:secret.optional(),instagramClientSecret:secret.optional(),threadsClientId:secret.optional(),threadsClientSecret:secret.optional()}).strict(),
  clear:z.array(z.enum(secretFields)).max(secretFields.length),
}).strict().refine(v=>!v.clear.some(k=>v.secrets[k]),'저장과 삭제를 동시에 할 수 없습니다.');
export type IntegrationInput = z.infer<typeof integrationInput>;
export interface Integrations extends Omit<IntegrationInput,'secrets'|'clear'> {
  configured:Record<SecretField,boolean>; encryptionReady:boolean; updatedAt:string|null;
}
export const connectionInput = z.object({revision:z.number().int().nonnegative(),token:secret}).strict();
export const connectionRevision = z.object({revision:z.number().int().nonnegative()}).strict();
export type ConnectionProvider='direct'|'buffer';
export interface Connection { channel:Channel; provider:ConnectionProvider; revision:number; username:string|null; userId:string|null; verifiedAt:string|null; expiresAt:string|null; connected:boolean; }
export interface BufferChannel { id:string; name:string; service:Channel; organizationName:string; externalLink:string|null; }
export const bufferConnectionInput=z.object({revision:z.number().int().nonnegative(),channelId:z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/)}).strict();
export const formatSchema=z.enum(['text','image','video']);
export type ContentFormat=z.infer<typeof formatSchema>;
export const generationInput=z.object({
  prompt:z.string().trim().max(1200).default(''),format:formatSchema,channel:channelSchema.optional(),language:z.enum(['ko','en']).default('ko'),
  reference:z.string().max(3_000_000).optional(),
}).strict().transform(v=>({...v,channel:v.channel??(v.format==='text'?'threads' as const:'instagram' as const)})).refine(v=>!(v.format==='text'&&v.channel==='instagram'),'Instagram은 이미지 또는 영상을 선택해 주세요.');
export type GenerationInput=z.infer<typeof generationInput>;
export interface GenerationQuote {id:string;totalUsd:number;lines:{label:string;usd:number}[];expiresAt:string;model:string;format:ContentFormat;}
export const generationConfirm=z.object({quoteId:z.uuid(),confirmed:z.literal(true)}).strict();
export const publishConfirm=z.object({revision:z.number().int().positive(),connectionRevision:z.number().int().nonnegative(),confirmed:z.literal(true)}).strict();
export interface GenerationJob {id:string;projectId:string;prompt:string;title:string|null;format:ContentFormat;channel:Channel;status:'quoted'|'queued'|'planning'|'submitting'|'rendering'|'completed'|'failed'|'uncertain';error:string|null;postId:string|null;createdAt:string;updatedAt:string;estimatedUsd:number;}
