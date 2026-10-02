/** Product-owned assets; minimo uses its approved companion vector master. */
export const productBrands: Record<
  string,
  { logo: string; category: string; repository: string; source: string; analyzed: string }
> = {
  clipit: {
    logo: '/brands/clipit.svg',
    category: 'AI 영상 클립 제작',
    repository: '~/projects/eun/clipit',
    source: 'apps/web/public/brand/app-icon.svg',
    analyzed: '2026. 09. 25',
  },
  minimo: {
    logo: '/brands/minimo.svg',
    category: 'AI 데스크톱 펫',
    repository: '~/projects/eun/desktop_pet',
    source: 'assets/brand/mark.svg',
    analyzed: '2026. 09. 25',
  },
  mellow: {
    logo: '/brands/mellow.svg',
    category: 'AI 음성 회화 학습',
    repository: '~/projects/eun/mellow',
    source: 'assets/brand/app-icon.svg',
    analyzed: '2026. 09. 25',
  },
  movy: {
    logo: '/brands/movy.png',
    category: '사진 → 챌린지 영상',
    repository: '~/projects/eun/movy',
    source: 'apps/mobile/assets/brandmark.png',
    analyzed: '2026. 09. 25',
  },
  desk: {
    logo: '/brands/desk.png',
    category: '뉴스 · 오디오 브리핑',
    repository: '~/projects/eun/desk',
    source: 'apps/mobile/assets/icon.png',
    analyzed: '2026. 09. 25',
  },
  atticcamera: {
    logo: '/brands/atticcamera.png',
    category: '레트로 카메라 앱',
    repository: '~/projects/eun/atticcamera',
    source: 'apps/mobile/assets/icon.png',
    analyzed: '2026. 10. 02',
  },
  kept: {
    logo: '/brands/kept.png',
    category: '성경 읽기 · 기도',
    repository: '~/projects/eun/kept',
    source: 'apps/mobile/assets/icon.png',
    analyzed: '2026. 10. 02',
  },
  dotori: {
    logo: '/brands/dotori.png',
    category: '하루 플래너',
    repository: '~/projects/eun/dotori',
    source: 'design/exports/app-icon.png',
    analyzed: '2026. 10. 02',
  },
};
