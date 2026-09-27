import { productCatalog20260925 } from './product-catalog-20260925';

/** User corrected the repository to desktop_pet; the product name/slug stays minimo. */
export const minimoDesktopPet = {
  slug: 'minimo', name: 'minimo', color: '#E4863A',
  description: '화면 위를 걸어 다니며 말을 걸면 답하고, 허락받은 화면을 함께 봐주는 AI 데스크톱 펫',
  audience: '컴퓨터로 오래 일하는 개발자·크리에이터·지식 작업자, 픽셀 캐릭터와 대화형 데스크톱 동반자를 좋아하는 사람. 기존 AI CLI를 활용하는 제품 흐름에서 도출한 고객 가설.',
  facts: '저장소 확인 · 2026-09-25 · desktop_pet\n• 다른 창 위를 걷고 뛰고 쉬는 픽셀 데스크톱 펫\n• 설치된 claude·codex·gemini CLI를 선택해 말풍선으로 대화하는 구성\n• 화면 보기 도구와 허용·거절·항상 허용 설정\n• 펫 선택, 이름·성격 설정\n근거: README.md, apps/desktop/src/config/ai_providers.ts, docs/specs/minimo-branding.md, docs/verification.md\n주의: macOS·Windows 대상이지만 README에서 Windows 실제 실행은 미검증으로 구분. Gemini 연동, 음성 재생·호출어 등의 실사용 검증도 남아 있음. 입력한 말과 허용한 화면은 선택한 AI 제공자에게 전달될 수 있음. 미니홈피·방명록 프로젝트가 아님.',
  tone: '작고 다정한 픽셀 동반자처럼 친근하고 간결하게. “화면 위에 사는 작은 펫”을 중심으로 산책·대화·함께 보기의 실제 장면을 보여줌.',
  avoid: '미니홈피·마당 꾸미기·친구 방문·방명록 등 다른 minimo 프로젝트 기능, 완전 오프라인·외부 전송 없음 주장, AI 제공자 비용까지 무료라는 표현, 무단 화면·클립보드 접근, 모든 CLI·Windows·음성 기능의 검증 완료 단정, 정서적 의존·치료 효과 보장.',
  website: '',
};

export const currentProductCatalog = productCatalog20260925.map(p => p.slug === 'minimo' ? minimoDesktopPet : p);
