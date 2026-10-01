import sharp from 'sharp';
import { MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES } from '@nullge/contracts';

export async function uploadedImage(data: string): Promise<Buffer> {
  const invalid = () => new Error('5 MB 이하의 올바른 PNG 또는 JPEG 이미지를 선택해 주세요.');
  if (data.length > Math.ceil(MAX_POST_IMAGE_BYTES / 3) * 4 + 32) throw invalid();
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw invalid();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_POST_IMAGE_BYTES || bytes.toString('base64') !== match[2])
    throw invalid();
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== match[1] || (metadata.pages || 1) > 1) throw invalid();
    // Decode and re-encode: strip embedded metadata and provide JPEG for social APIs.
    const content = await image
      .rotate()
      .resize({ width: 2160, height: 2160, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
    if (content.length > MAX_POST_IMAGE_BYTES) throw invalid();
    return content;
  } catch {
    throw invalid();
  }
}

export interface UploadedMedia {
  content: Buffer;
  mime: 'image/jpeg' | 'video/mp4';
  format: 'image' | 'video';
}
/** Accepts the manual attachment data URL: images are re-encoded as JPEG, MP4 files are kept as uploaded. */
export async function uploadedMedia(data: string): Promise<UploadedMedia> {
  if (data.startsWith('data:video/mp4;'))
    return { content: uploadedVideo(data), mime: 'video/mp4', format: 'video' };
  return { content: await uploadedImage(data), mime: 'image/jpeg', format: 'image' };
}
export function uploadedVideo(data: string): Buffer {
  const invalid = () => new Error('15 MB 이하의 올바른 MP4 영상을 선택해 주세요.');
  if (data.length > Math.ceil(MAX_POST_VIDEO_BYTES / 3) * 4 + 32) throw invalid();
  const match = /^data:video\/mp4;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw invalid();
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length < 64 || bytes.length > MAX_POST_VIDEO_BYTES || bytes.toString('base64') !== match[1])
    throw invalid();
  // ISO BMFF: walk the top-level boxes; sizes must tile the file exactly (a truncated upload fails here).
  const types: string[] = [];
  for (let offset = 0; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw invalid();
    let size: number = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    if (size === 1) {
      if (offset + 16 > bytes.length) throw invalid();
      size = Number(bytes.readBigUInt64BE(offset + 8));
    } else if (size === 0) size = bytes.length - offset;
    if (size < 8 || offset + size > bytes.length) throw invalid();
    types.push(type);
    offset += size;
  }
  if (types[0] !== 'ftyp' || !types.includes('moov') || !types.includes('mdat')) throw invalid();
  const brand = bytes.toString('latin1', 8, 12);
  if (!/^(isom|iso2|iso4|iso5|iso6|mp41|mp42|avc1|M4V |dash|qt  )$/.test(brand)) throw invalid();
  return bytes;
}
