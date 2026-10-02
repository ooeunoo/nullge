import type { Project } from '@nullge/contracts';

/**
 * Products added on 2026-10-02 from ~/projects/eun/{atticcamera,kept,dotori}. Repository inspection snapshot,
 * not a release or marketing approval: every profile starts unreviewed and bootstrap never overwrites edits.
 */
export const productCatalog20261002: Omit<Project, 'id' | 'revision' | 'profileReviewedAt' | 'guide'>[] = [
  {
    slug: 'atticcamera',
    name: '다락방 카메라',
    color: '#EAA77E',
    description: '1970–2012년 추억의 카메라 35대를 골라 그 시절 색감으로 오늘을 찍는 iOS·Android 카메라 앱',
    audience:
      '필름 카메라·똑딱이 디카·옛 폰카 감성을 좋아하고 일상과 여행을 레트로 톤으로 남기려는 사람. 필터 앱보다 "그 카메라로 찍는 경험"을 원하는 사용자를 중심으로 한 타깃 가설이며 고객 조사 결과는 아님.',
    facts:
      '저장소 확인 · 2026-10-02 · atticcamera\n• 1970 Olympus PEN EE-2부터 2012 Fujifilm instax mini 8까지 카메라 35대(Polaroid SX-70, Contax T2, Game Boy Camera, Anycall SCH-V200, iPhone 4 등)\n• 카메라마다 렌즈 특성·필름 입자·플래시·날짜 각인·셔터음을 재현하고, 뷰파인더와 결과 사진이 같은 처리로 현상됨\n• 동영상 촬영, 예전 앨범 사진을 원하는 카메라로 다시 현상\n• 사진은 앱 앨범과 사진 앱에만 저장. 자체 서버 업로드·로그인·광고 없음\n• 무료 다운로드 + 인앱 결제(평생·연간 이용권)\n근거: README.md, docs/store-listing.md, docs/business-model.md, apps/mobile/app.json\n주의: 카메라 이름은 모사한 실제 모델명이며 로고·바디 디자인은 자체 창작, 제조사 제휴가 아님. 무료 범위는 문서마다 다름(store-listing.md "모든 카메라 하루 3장", business-model.md "무료 6대 + 워터마크 체험") — 게시 전 현재 빌드와 스토어 상품으로 확인. 스토어 상품 등록 전 초안 상태였고 공개 출시 여부는 확인하지 않음.',
    tone: '다락방에서 옛 카메라를 꺼낸 듯 따뜻하고 담백하게. "한 컷에 남는 그 시절의 색"처럼 카메라 한 대와 그 시절 장면 하나를 짝지어 구체적으로 보여줌.',
    avoid:
      '카메라 제조사의 공식 제휴·인증·라이선스 암시, 실제 필름·기기와 완전히 같다는 보장, 타사 로고·제품 사진 사용, 확인하지 않은 가격·무료 장수·출시 상태, 다른 사람이 찍은 사진을 앱 결과물처럼 소개.',
    website: 'https://atticcamera.nullge.com/',
  },
  {
    slug: 'kept',
    name: 'Kept',
    color: '#3E5C4E',
    description: '매일 내 속도대로 성경을 읽고 듣고 기도하는, 광고도 가입도 없는 조용한 성경·기도 앱',
    audience:
      '말씀 읽기와 기도를 매일 조용히 이어가고 싶은 기독교인, 구역·소그룹·가족과 같은 본문을 함께 읽으려는 사람. 제품 스펙의 1차 출시 대상은 영어권이며 한국어는 14개 화면 언어 중 하나.',
    facts:
      '저장소 확인 · 2026-10-02 · kept\n• 오늘의 10분: 오늘 본문 듣기 → 적어 둔 기도 제목으로 기도 → 감사 한 줄\n• 영어 BSB 내장(오프라인), 저작권 없는 번역본 내려받기(KJV, WEB, Reina-Valera 1909, Louis Segond, Luther 1912, 和合本 등)\n• 장 낭독과 읽는 절 표시, 화면을 꺼도 재생, 잠들기 전 수면 타이머\n• 읽기 플랜(7일 첫걸음, 21일 요한복음, 30일 시편, 90일 신약, 1년 일독 등), 건너뛰어도 멈춘 곳부터\n• 기도 제목·알림·응답 표시, 링크로 초대하는 함께 읽기 그룹\n• 큰 글씨·명조/고딕·밝은/어두운 화면, 화면 언어 14개\n• 계정 없이 시작, 메모와 기도 제목은 기기에만 저장, 광고 없음\n• 프리미엄(선택): 기도 제목 무제한(무료 3개)과 세피아 화면. 월간·연간 구독 또는 평생 이용권\n근거: store/listing.md, docs/specs/kept.md, docs/harness/state.json\n주의: 스토어 등록 정보와 인앱 상품을 준비하는 단계였고 공개 출시 여부·가격은 확인하지 않음. 번역본 목록에 한국어 성경은 없으므로 한국어 성경 제공을 약속하지 않음.',
    tone: '조용하고 절제된 문장. 다그치거나 죄책감을 주지 않고, 읽기·듣기·기도·감사의 작은 순서를 차분히 보여줌.',
    avoid:
      '연속 기록 압박이나 죄책감을 주는 문구, 기도 응답·신앙 성장 보장, 특정 교단·교리 주장이나 타 종교·타 성경 앱 비방, 목록에 없는 번역본(한국어 성경 등) 제공 약속, 확인하지 않은 가격·출시 상태, 기도 내용이 서버에 저장된다는 오해를 주는 표현.',
    website: 'https://kept.nullge.com/',
  },
  {
    slug: 'dotori',
    name: 'Dotori',
    color: '#99603C',
    description:
      '오늘 할 일은 3–5개만 담고, 못 한 일은 다정하게 내일로 넘기는 하루 플래너 (한국어 이름: 두토리)',
    audience:
      '할 일 앱을 쓰다 밀린 목록과 연속 기록 압박에 지친 사람, 미루는 습관이 있어도 다그치지 않는 플래너를 찾는 사람. 랜딩·스토어 문구를 바탕으로 한 타깃 가설.',
    facts:
      '저장소 확인 · 2026-10-02 · dotori\n• 한국어 스토어 이름 "두토리 - 다정한 하루 플래너", 영어 "Dotori: Gentle Day Planner"\n• 오늘 몫은 3–5개, 다 끝내면 도토리 보너스. 도토리는 줄어들지 않고 연속 기록 압박이 없음\n• "내일 3시 치과"처럼 말하듯 적으면 날짜·시간을 인식(한국어·영어, 공휴일·음력)\n• 못 한 일은 "넘어온 일"로 옮기고, 세 번째 넘어오면 쪼개기·날짜 정하기·보관·내려놓기 중 함께 고름\n• 알림은 무료: 정한 시각에 울리고 5·15·30분 뒤 다시 알림, 알림에서 완료·10분 뒤·내일로\n• 계정 없이 모든 기능, 기록은 기기에 먼저 저장. Apple·Google 연결 시 기기 간 동기화, CSV·JSON 내보내기, 계정 삭제\n• 플러스(선택): AI 무제한(무료 월 30회)·양방향 캘린더·추가 테마·상세 통계, 광고 없음. 카드 없이 14일 체험\n• 무료 사용자에게는 목록 사이의 조용한 네이티브 광고만 표시(전면·자동재생 없음)\n근거: store/ios/ko/metadata.json, docs/specs/billing.md, docs/specs/ads.md, docs/specs/web-landing.md, docs/harness/platforms.json\n주의: 스토어는 내부 테스트·심사 준비 단계였고 공개 출시 여부는 확인하지 않음. 가격(연간·월간)은 스토어에서 바뀔 수 있어 게시 전 확인. 한국어 소개 페이지는 https://dotori.nullge.com/ko/.',
    tone: '"오늘은, 이만큼이면 충분해"처럼 다정하고 가벼운 말투. 미룬 일을 탓하지 않고, 작은 오늘과 다음 한 걸음을 구체적인 장면으로 보여줌.',
    avoid:
      '생산성·습관 형성 효과 보장, 미루는 사람을 탓하거나 불안을 자극하는 문구, 연속 기록 경쟁 유도, "광고 없음"을 무료 플랜에까지 적용, 확인하지 않은 가격·체험 조건·출시 상태, ADHD 등 의학적 효능 암시.',
    website: 'https://dotori.nullge.com/',
  },
];
