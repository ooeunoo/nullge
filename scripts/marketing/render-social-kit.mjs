#!/usr/bin/env node
// Renders social profile images (1080×1080) and X banners (1500×500, ko/en) for each product.
// Usage: node scripts/marketing/render-social-kit.mjs [out-dir]   (default .local/marketing/social-kit)
// Source icons come from the product repositories next to this one (~/projects/eun/<repo>).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'packages/database/package.json'));
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');
const projects = resolve(root, '..');
const fonts = ['Pretendard-ExtraBold.otf', 'Pretendard-SemiBold.otf'].map((f) =>
  join(root, 'packages/database/fonts', f),
);
const out = resolve(process.argv[2] || join(root, '.local/marketing/social-kit'));

const products = [
  {
    slug: 'clipit',
    icon: 'clipit/apps/web/public/brand/app-icon.svg',
    color: '#FF7959',
    name: { ko: 'ClipIt', en: 'ClipIt' },
    tagline: { ko: '긴 영상 속 하이라이트, 세로 클립으로', en: 'Long videos in, vertical clips out' },
  },
  {
    slug: 'mellow',
    icon: 'mellow/assets/brand/app-icon-1024.png',
    color: '#78A547',
    name: { ko: 'mellow', en: 'mellow' },
    tagline: { ko: '공부 말고, 통화할까요?', en: 'Skip the textbook. Take the call.' },
  },
  {
    slug: 'atticcamera',
    icon: 'atticcamera/apps/mobile/assets/icon.png',
    color: '#EAA77E',
    name: { ko: '다락방 카메라', en: 'Attic Camera' },
    tagline: { ko: '한 컷에 남는 그 시절의 색', en: 'The colors of then, in a single shot' },
  },
  {
    slug: 'kept',
    icon: 'kept/apps/mobile/assets/icon.png',
    color: '#3E5C4E',
    name: { ko: 'Kept', en: 'Kept' },
    tagline: { ko: '읽고, 듣고, 기도해요. 조용히.', en: 'Read, listen, pray. Quietly.' },
  },
  {
    slug: 'dotori',
    icon: 'dotori/design/exports/app-icon.png',
    color: '#99603C',
    name: { ko: '두토리', en: 'Dotori' },
    tagline: { ko: '오늘은, 이만큼이면 충분해', en: 'Today, this much is enough' },
  },
];

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgPng = (svg, width) =>
  new Resvg(svg, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' },
  })
    .render()
    .asPng();
function ink(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b) > 0.4 ? '#1E1B18' : '#FFFFFF';
}
async function iconPng(p, size) {
  const file = join(projects, p.icon);
  const input = file.endsWith('.svg') ? svgPng(readFileSync(file, 'utf8'), size) : readFileSync(file);
  return sharp(input).resize(size, size, { fit: 'cover' }).png().toBuffer();
}
// X places the avatar over the lower-left of the banner, so content sits right of center.
async function banner(p, lang) {
  const color = ink(p.color);
  const icon = await sharp(await iconPng(p, 168))
    .composite([
      {
        input: Buffer.from('<svg width="168" height="168"><rect width="168" height="168" rx="38"/></svg>'),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500">
    <text x="660" y="232" font-family="Pretendard" font-weight="800" font-size="76" letter-spacing="-2" fill="${color}">${escape(p.name[lang])}</text>
    <text x="660" y="300" font-family="Pretendard" font-weight="600" font-size="40" fill="${color}" fill-opacity="0.9">${escape(p.tagline[lang])}</text>
  </svg>`;
  return sharp({ create: { width: 1500, height: 500, channels: 3, background: p.color } })
    .composite([
      { input: icon, left: 452, top: 166 },
      { input: svgPng(text), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

for (const p of products) {
  const dir = join(out, p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'profile.png'), await iconPng(p, 1080));
  for (const lang of ['ko', 'en']) writeFileSync(join(dir, `x-banner-${lang}.png`), await banner(p, lang));
  console.log(`${p.slug}: profile.png, x-banner-ko.png, x-banner-en.png`);
}
console.log(`→ ${out}`);
