/** Product-owned assets; minimo uses its approved companion vector master. */
export const productBrands: Record<string, { logo: string; category: string; repository: string; source: string }> = {
  clipit: { logo: '/brands/clipit.svg', category: 'AI 영상 클립 제작', repository: '~/projects/eun/clipit', source: 'apps/web/public/brand/app-icon.svg' },
  minimo: { logo: '/brands/minimo.svg', category: 'AI 데스크톱 펫', repository: '~/projects/eun/desktop_pet', source: 'assets/brand/mark.svg' },
  mellow: { logo: '/brands/mellow.svg', category: 'AI 음성 회화 학습', repository: '~/projects/eun/mellow', source: 'assets/brand/app-icon.svg' },
  movy: { logo: '/brands/movy.png', category: '사진 → 챌린지 영상', repository: '~/projects/eun/movy', source: 'apps/mobile/assets/brandmark.png' },
  desk: { logo: '/brands/desk.png', category: '뉴스 · 오디오 브리핑', repository: '~/projects/eun/desk', source: 'apps/mobile/assets/icon.png' },
};
