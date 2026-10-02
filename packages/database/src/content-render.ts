import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import type { ContentGuide, TemplateKind } from '@nullge/contracts';
import { StoreError } from './store';

/**
 * Shared template renderer. Layout presets live here; every product-specific value (colors, words, logo,
 * photo) is an input taken from the product's content guide or the post. No product names or copy in code.
 */
export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1350;
const FONT_DIR = join(__dirname, '..', 'fonts');
const FONT_FILES = ['Pretendard-ExtraBold.otf', 'Pretendard-SemiBold.otf'].map((f) => join(FONT_DIR, f));
const FAMILY = 'Pretendard';

export interface RenderInput {
  kind: Exclude<TemplateKind, 'none'>;
  palette: ContentGuide['visual']['palette'];
  tagline: string;
  headline: string[];
  subline: string;
  photo?: Buffer;
  logo?: Buffer;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rough width of a line in em units: full-width for CJK, narrower for Latin. Good enough to pick a font size. */
function emWidth(text: string) {
  let w = 0;
  for (const ch of text) w += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 1 : 0.58;
  return w;
}
function fitSize(lines: string[], maxWidth: number, max: number, min: number) {
  const widest = Math.max(...lines.map(emWidth), 1);
  return Math.max(min, Math.min(max, Math.floor(maxWidth / widest)));
}

function textSvg(input: RenderInput) {
  const { palette, headline, subline, tagline, kind } = input;
  const margin = 72;
  const width = RENDER_WIDTH - margin * 2;
  const size = fitSize(headline, width, kind === 'color-card' ? 120 : 104, 56);
  const lineHeight = Math.round(size * 1.18);
  const top = kind === 'color-card' ? Math.round(RENDER_HEIGHT * 0.3) : 96 + size;
  const lines = headline
    .map(
      (line, i) =>
        `<text x="${margin}" y="${top + i * lineHeight}" font-family="${FAMILY}" font-weight="800" font-size="${size}" letter-spacing="${(-size * 0.03).toFixed(1)}" fill="${i === headline.length - 1 && headline.length > 1 ? palette.accent : palette.ink}">${escape(line)}</text>`,
    )
    .join('');
  const subSize = fitSize([subline || ' '], width, 38, 26);
  const sub = subline
    ? `<text x="${margin}" y="${top + (headline.length - 1) * lineHeight + Math.round(size * 0.55) + subSize + 10}" font-family="${FAMILY}" font-weight="600" font-size="${subSize}" fill="${palette.ink}" fill-opacity="0.88">${escape(subline)}</text>`
    : '';
  const tag = tagline
    ? `<text x="${margin}" y="${RENDER_HEIGHT - 64}" font-family="${FAMILY}" font-weight="600" font-size="26" fill="${palette.ink}" fill-opacity="0.85">${escape(tagline)}</text>`
    : '';
  const shade =
    kind === 'photo-headline'
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${palette.background}" stop-opacity="0.86"/>
          <stop offset="0.26" stop-color="${palette.background}" stop-opacity="0.55"/>
          <stop offset="0.48" stop-color="${palette.background}" stop-opacity="0"/>
          <stop offset="0.70" stop-color="${palette.background}" stop-opacity="0"/>
          <stop offset="1" stop-color="${palette.background}" stop-opacity="0.78"/>
        </linearGradient></defs><rect width="${RENDER_WIDTH}" height="${RENDER_HEIGHT}" fill="url(#g)"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RENDER_WIDTH}" height="${RENDER_HEIGHT}">${shade}${lines}${sub}${tag}</svg>`;
}

function rasterize(svg: string) {
  return new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FAMILY },
  })
    .render()
    .asPng();
}

/** Logos keep their transparency; they are only resized and re-encoded as PNG. */
export async function normalizeLogo(bytes: Buffer) {
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!['png', 'jpeg'].includes(meta.format || '') || (meta.pages || 1) > 1) throw new Error();
    return await image
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new StoreError(400, '1 MB 이하의 PNG 또는 JPEG 로고를 올려 주세요.');
  }
}

/** Renders a 1080×1350 JPEG poster. Throws StoreError when a required input is missing. */
export async function renderTemplate(input: RenderInput): Promise<Buffer> {
  if (!input.headline.length || input.headline.length > 2 || input.headline.some((l) => !l.trim()))
    throw new StoreError(400, '헤드라인을 1–2줄로 입력해 주세요.');
  if (input.kind === 'photo-headline' && !input.photo)
    throw new StoreError(400, '사진이 있는 게시물에만 사진 템플릿을 적용할 수 있어요.');
  const base = input.photo
    ? sharp(input.photo, { limitInputPixels: 40_000_000 }).rotate().resize(RENDER_WIDTH, RENDER_HEIGHT, {
        fit: 'cover',
        position: 'attention',
      })
    : sharp({
        create: {
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          channels: 3,
          background: input.palette.background,
        },
      });
  const layers: OverlayOptions[] = [{ input: rasterize(textSvg(input)), top: 0, left: 0 }];
  if (input.logo) {
    const logo = await sharp(input.logo)
      .resize({ height: input.tagline ? 64 : 80, width: 360, fit: 'inside' })
      .png()
      .toBuffer();
    const meta = await sharp(logo).metadata();
    layers.push({
      input: logo,
      left: 72,
      top: RENDER_HEIGHT - (input.tagline ? 112 : 64) - (meta.height || 0),
    });
  }
  return base
    .composite(layers)
    .flatten({ background: input.palette.background })
    .jpeg({ quality: 90 })
    .toBuffer();
}
