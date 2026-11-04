import type { Project } from '@nullge/contracts';

/**
 * Product added on 2026-11-04 from ~/projects/eun/vyvo. Repository inspection snapshot, not a release or
 * marketing approval: the profile starts unreviewed and bootstrap never overwrites edits.
 */
export const productCatalog20261104: Omit<Project, 'id' | 'revision' | 'profileReviewedAt' | 'guide'>[] = [
  {
    slug: 'vyvo',
    name: 'VYVO',
    color: '#FF739E',
    description:
      '18가지 크리에이티브 필터로 일상 사진을 더 선명하고 생생한 색으로 남기는 iOS·Android 카메라·사진 편집 앱 ("Make everyday vivid")',
    audience:
      '일상·여행·풍경 사진을 선명한 색감과 분위기 있는 톤으로 바로 남기고 싶은 사람, 복잡한 수동 카메라보다 필터 하나와 강도 조절로 끝내길 원하는 사용자. 영어권 우선 출시(스토어·사이트 모두 영어)를 바탕으로 한 타깃 가설이며 고객 조사 결과는 아님.',
    facts:
      '저장소 확인 · 2026-11-04 · vyvo\n• 영어 스토어 이름 "VYVO - Vivid Camera", 부제 "Rich color. Everyday moments.", 슬로건 "Make everyday vivid."\n• 필터 18종: Vivid, Vivid+, Vivid Soft, Vivid Pop, Anime Scenery, Painted Scenery, Soft Glow, Cel Toon, Dramatic Landscape, Clear, Fresh, Sunny, Blossom, Ocean, Daily, Retro, Film, Mono\n• 카메라에서 선택한 필터 미리보기, 전·후면 전환, 타이머·격자·사진 비율, 앨범 사진 불러오기\n• 필터 강도 조절, 밝기·대비·색·색온도 보정, 원본과 비교 후 저장\n• 앱 갤러리 저장·즐겨찾기, 기기 사진 앱으로 내보내기, 원하는 서비스로 공유\n• 유료 다운로드 한 번에 현재 필터 18종 전부 포함. 구독·추가 필터 결제·광고 없음(스토어 설정상 US $2.99)\n• VYVO 계정 없음, 사진 처리는 기기에서만 하고 VYVO 서버로 올리지 않음. 마이크·위치 권한 없음, 분석 SDK 없음\n• 사진 전용. 동영상 촬영은 현재 버전에 없음\n• 번들 com.nullge.vyvo, 지원 메일 vyvo@nullge.com\n근거: README.md, docs/store-metadata.en.json, docs/store-setup.json, docs/pricing-research.json, apps/web/public/{index,privacy/index,support/index}.html, apps/mobile/app.json\n주의: 아직 출시 전("Coming to iOS & Android", 2026-10-21 기준 App Store "Prepare for Submission", Google Play "Draft"). 스토어 링크 없음 — 다운로드 가능하다고 쓰지 않음. 가격 $2.99는 저장소 설정 기록이며 지역별 가격은 스토어가 정함, 게시 전 스토어에서 확인. 사이트 https://vyvo.nullge.com/ 은 2026-11-04 연결 중(이 시점 DNS 미해석). 사이트 샘플·앱 화면은 개발 미리보기이고 실기기 카메라 성능은 미검증. 한국어 앱·스토어 문구는 없음.',
    tone: '"A little more colour. A lot more feeling."처럼 짧고 경쾌하며 감정에 닿는 영어 문장. 같은 장면을 필터 하나로 바꾸는 전·후 비교와 구체적인 필터 이름을 보여줌.',
    avoid:
      '이미 출시됐거나 지금 내려받을 수 있다는 표현, 무료라는 표현, 확인하지 않은 가격·스토어 링크, 동영상 촬영 기능, 실제 사진 품질·카메라 성능 보장, 다른 사람이 찍은 사진이나 실제와 다른 결과물을 앱 결과처럼 소개, 사진이 서버로 전송된다는 오해를 주는 표현.',
    website: 'https://vyvo.nullge.com/',
  },
];
