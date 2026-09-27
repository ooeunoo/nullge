import sharp from 'sharp';
import { MAX_POST_IMAGE_BYTES } from '@nullge/contracts';

export async function uploadedImage(data: string): Promise<Buffer> {
  const invalid = () => new Error('5 MB 이하의 올바른 PNG 또는 JPEG 이미지를 선택해 주세요.');
  if (data.length > Math.ceil(MAX_POST_IMAGE_BYTES / 3) * 4 + 32) throw invalid();
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw invalid();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_POST_IMAGE_BYTES || bytes.toString('base64') !== match[2]) throw invalid();
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== match[1] || (metadata.pages || 1) > 1) throw invalid();
    // Decode and re-encode: strip embedded metadata and provide JPEG for social APIs.
    const content = await image.rotate().resize({ width: 2160, height: 2160, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
    if (content.length > MAX_POST_IMAGE_BYTES) throw invalid();
    return content;
  } catch { throw invalid(); }
}
