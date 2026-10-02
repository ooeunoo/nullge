import type { Project } from '@nullge/contracts';

/** Repository inspection snapshot, not a release/marketing approval. Keep immutable for migration replay. */
export const productCatalog20260925: Omit<Project, 'id' | 'revision' | 'profileReviewedAt' | 'guide'>[] = [
  {
    slug: 'clipit',
    name: 'ClipIt',
    color: '#FF7959',
    description: '긴 영상에서 AI 하이라이트를 찾아 제목·자막과 함께 세로 클립으로 만드는 서비스',
    audience:
      '기존 긴 영상을 숏폼으로 재활용하려는 영상 크리에이터, 스트리머, 콘텐츠 운영자. 저장소의 제작 흐름을 바탕으로 한 타깃 가설이며 고객 조사 결과는 아님.',
    facts:
      '저장소 확인 · 2026-09-25\n• 긴 영상의 AI 하이라이트 분석과 세로 클립 제작\n• 웹 편집기에서 제목·자막·템플릿 편집\n• URL 또는 파일 업로드 기반 영상 처리\n근거: README.md, apps/web/src/messages/ko.json, apps/web/src/app/layout.tsx\n주의: 코드·문서 확인 기준. 현재 요금, 처리 속도, 지원 플랫폼 및 운영 가용성은 게시 전에 별도 확인.',
    tone: '제작 과정과 결과를 구체적으로 보여주는 짧고 실용적인 말투. 긴 영상 → 하이라이트 → 편집된 클립 순서로 설명.',
    avoid:
      '조회수·바이럴·수익 보장, 측정하지 않은 시간 절감률, 무제한·무료 등 미확인 요금, 모든 영상·플랫폼 지원 단정, 타인 영상의 무단 재사용 권장.',
    website: 'https://clipit.studio/',
  },
  {
    slug: 'minimo',
    name: 'minimo',
    color: '#3E8948',
    description: 'AI 미니모와 대화하고 마당을 꾸미며 친구와 방문·방명록을 나누는 미니홈피',
    audience:
      '나만의 공간과 캐릭터 꾸미기, 미니홈피·방명록 감성, 부담 적은 친구 교류를 좋아하는 사람. docs/vision.md의 제품 방향을 요약한 타깃 가설.',
    facts:
      '저장소 확인 · 2026-09-25\n• 미니모 캐릭터 외형과 옷 꾸미기, 마당의 소품 배치\n• 성격에 따른 AI 채팅\n• 친구 코드로 추가하고 마당 방문·새싹 선물\n• 공개·비공개 방명록과 주인장 답글\n근거: README.md, docs/vision.md, apps/server/src/room, chat, admin\n범위 구분: 여러 방·BGM은 후속 범위. 실제 결제는 vision 문서에서 미구현으로 구분. 출시·스토어 공개 여부는 확인하지 않음.',
    tone: '아늑하고 다정한 짧은 문장. 마당·새싹·방문처럼 제품 안의 말을 사용하고, 꾸미기와 작은 인사를 중심으로 설명.',
    avoid:
      '치료·상담 효과나 AI의 인간성 보장, 과도한 정서적 의존 유도, 미구현 BGM·여러 방·결제 홍보, 확인하지 않은 출시·이용 연령·개인정보 보호 주장.',
    website: '',
  },
  {
    slug: 'mellow',
    name: 'mellow',
    color: '#78A547',
    description: 'AI 캐릭터와 음성 통화하고 대화 리포트·표현 복습으로 이어가는 외국어 회화 서비스',
    audience:
      '영어·일본어·중국어·스페인어 말하기를 일상에서 연습하고 싶은 학습자. 말문을 여는 부담을 줄이고 꾸준히 회화하려는 사용자를 중심으로 한 타깃 가설.',
    facts:
      '저장소 확인 · 2026-09-25\n• AI 캐릭터와 음성 통화로 영어·일본어·중국어·스페인어 학습\n• 통화 후 대화 리포트와 표현 복습\n• 캐릭터별 프로필과 대화 기억 갱신\n• 예약 알림 처리\n근거: README.md, store/characters/README.md, assets/brand/README.md\n주의: 실제 스토어 공개 상태와 결제·통화 품질은 별도 검증 대상. 무료 횟수·시간과 요금은 변경 가능하므로 홍보 전 재확인.',
    tone: '부담 없이 말을 꺼내도록 돕는 친근하고 차분한 말투. 실생활 대화 장면과 작은 연습을 구체적으로 보여줌.',
    avoid:
      '단기간 유창함·점수 상승 보장, 실제 원어민 교사라고 표현, 상담·치료 효과, 확인하지 않은 스토어 출시·가격·무료 제공량, 사람이 직접 전화한다는 오해.',
    website: 'https://www.mellowcall.com/',
  },
  {
    slug: 'movy',
    name: 'Movy',
    color: '#D7FF66',
    description: '챌린지를 고르고 내 사진에 움직임을 입혀 짧은 영상을 만드는 모바일 앱',
    audience:
      '자신의 사진으로 챌린지·댄스 영상을 만들고 공유하려는 숏폼 이용자. 사람·반려동물 사진 활용은 제품 방향이지만 동물 결과 품질 검증은 별도 필요.',
    facts:
      '저장소 확인 · 2026-09-25\n• 챌린지 탐색 → 사진 선택 → 영상 생성 → 저장·공유 흐름\n• 생성 상태 확인·재생·실패 재시도 화면\n• 관리자에서 참조 영상·샘플을 등록하고 미리보기 검토 후 공개하는 흐름\n근거: README.md, docs/design/brand.md, apps/mobile/app.json\n범위 구분: README는 사람/동물 자동 검출, 동물 결과 품질, 실제 유행 챌린지 공개를 남은 작업으로 구분. 로그인·결제는 연결 코드와 실제 운영 검증을 구분해야 함. 출시 상태 미확인.',
    tone: '“이 챌린지, 내 사진으로.”처럼 짧고 경쾌하게. 선택·만들기·저장 등 다음 행동과 결과를 알려주되 샘플과 실제 생성 품질을 구분.',
    avoid:
      '동물 모션·모든 사진에서 품질 보장, 즉시 생성·바이럴 보장, 미확인 무료·환불 정책, 샘플을 실제 사용자 결과로 소개, 타인의 얼굴·사진·챌린지 권리 무시.',
    website: '',
  },
  {
    slug: 'desk',
    name: 'desk',
    color: '#C6F24E',
    description: '오늘의 뉴스 브리핑을 듣고 이슈 순위와 팟캐스트 대본을 함께 살펴보는 앱',
    audience:
      '출퇴근·이동 중 오늘의 이슈를 듣고 핵심을 빠르게 파악하려는 한국어 사용자. 홈 화면의 원탭 브리핑 흐름과 카피 가이드를 바탕으로 한 타깃 가설.',
    facts:
      '저장소 확인 · 2026-09-25\n• 홈의 오늘의 브리핑 재생과 인기 이슈 순위\n• 팟캐스트 목록·플레이어·구간별 대본 화면\n• 서버의 팟캐스트 조회·이슈 랭킹 API\n• 뉴스 수집·분석에서 대본 작성·음성 합성으로 이어지는 워커 구성\n근거: apps/mobile/src/features/home/HomeScreen.tsx, features/player/TranscriptScreen.tsx, features/live/LiveScreen.tsx, apps/server/src/podcast, package.json\n주의: 실시간성·정확도·정시 발행·스토어 공개는 코드만으로 보장하지 않음. 과거 기획 문서와 현재 구현을 구분.',
    tone: '결론부터, 짧은 문장, 쉬운 한국어. “한눈에”, “왜 중요해”처럼 맥락을 설명하고 출처·시점을 함께 표시. docs/copy-guide.md의 방향을 참고.',
    avoid:
      '출처·시점 없는 뉴스 단정, 완벽한 중립성·정확도 보장, 실제 사건처럼 보이는 생성 이미지·음성, 투자 수익 보장, 타 매체 구독자 수나 성과를 Desk의 성과로 인용.',
    website: '',
  },
];
