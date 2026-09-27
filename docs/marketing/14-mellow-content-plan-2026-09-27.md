# mellow 콘텐츠 기획 · 2026-09-27

작성 근거: `~/projects/eun/mellow` 2026-08-15 이후 163개 커밋, `store/listing.md`, `docs/deployment.md`, `packages/core/src/marketing/marketing-policy.ts`, `docs/marketing/content.json`. Console 제품 정보는 버전 3으로 갱신·확인 완료.

## 전제

- 공개 버전 기준으로만 말한다: 영어·일본어·중국어·스페인어, AI 친구 11명. 1.0.3(8개 언어·19명)은 스토어 심사 중이라 제외.
- 미디어는 Higgsfield 웹앱(Basic, 월 70크레딧)에서 만든다. API 잔액은 아직 없으므로 Console 자동 생성은 쓰지 않는다.
- AI 이미지·영상에는 문구에 "AI로 제작한 이미지/영상입니다"를 넣는다. 실제 앱 화면을 흉내 낸 가짜 UI, 읽히는 텍스트·로고는 만들지 않는다.
- 말투: 'AI 친구', '당신' 금지, 효과 보장 금지, 무료 체험·출시 예정 표현 금지.

## 기존 소재와 겹치지 않게

이미 쓰인 각도(mellow `docs/marketing/content.json` P01–P06·T01–T06, 관리자 프리셋 9개, Console 초안 3개): 회화 연습을 내가 시작하지 않아도 됨, 퇴근 후 전화, 막힐 때 한 문장, 통화 후 표현 하나 더, 무료 통화량, 첫 통화 주제, 생각할 시간, 다른 언어 예고, 통화 시간 투표, 일반 소개.

이번에 새로 쓰는 각도: 앱을 닫아도 울리는 벨, 귀에 대면 꺼지는 화면, 직접 입력하는 장면, 복습 카드(내 녹음+AI 예시 발음), 통화 중 자막·힌트와 침묵 체크인, AI 친구 소개.

## 기획 6건

| # | 채널·형식 | 제목 | 각도 | 미디어 |
| --- | --- | --- | --- | --- |
| 1 | Instagram · 이미지 | 앱을 닫아 두어도, 전화는 옵니다 | 예약 통화가 실제 전화처럼 울림 | 저녁 책상 위 뒤집힌 폰, 연두빛 |
| 2 | Instagram · 이미지 | 귀에 대면, 화면은 꺼져요 | 수화기 모드, 화면 안 보고 말하기 | 해질녘 골목, 통화하며 걷는 사람 |
| 3 | Instagram · 이미지 | 오늘의 장면: 카페에서 음료 주문하기 | 직접 입력한 장면으로 통화 시작 | 시애틀 카페 바리스타 |
| 4 | Instagram · 이미지 | 막혔던 문장은 카드로 돌아와요 | 리포트 → 복습 카드, 내 녹음+AI 예시 | 아침 책상, 빈 카드와 이어폰 |
| 5 | Instagram · 영상 5초 | 말이 막혀도, 대화는 계속 | 자막·번역·힌트, 30초 침묵 체크인 | 소파에서 통화하며 생각하다 웃는 장면 |
| 6 | Threads · 글 | 오늘은 누구랑 통화할까요? | AI 친구 11명 중 4명 소개 | 없음 |

## 미디어 프롬프트 (Higgsfield 웹앱)

이미지 비율 4:5, 영상 9:16 5초. 사람은 가상의 성인, 얼굴은 자연스럽게, 텍스트·로고·화면 UI 없음.

1. A smartphone lying face-down on a warm wooden desk in a cozy evening apartment, soft lime-green glow spilling from under the phone as if ringing, blurred lamp and a mug in the background, editorial product photography, no text, no screen visible.
2. A young adult walking along a quiet Seoul side street at dusk, holding a phone to the ear with a relaxed smile, warm street lights, shallow depth of field, phone screen not visible, candid editorial photo, no text.
3. A friendly barista in her late twenties behind a cozy Seattle café counter, smiling and handing over a paper cup, warm morning light, espresso machine and pastries blurred, editorial lifestyle photo, no readable text or logos.
4. Morning desk scene with a small stack of blank index cards, a pen, wireless earbuds and a phone face down, soft sunlight, pale paper tones with a lime-green accent, minimal editorial still life, no text.
5. (영상) A young adult sitting on a sofa at home in the evening, phone at ear, pauses thoughtfully then smiles and nods, subtle slow push-in, warm lamp light, vertical, no on-screen text.

브랜드 색 참고: paper `#faf9f5`, charcoal `#212620`, lime `#c6ed82`, green `#78a547`.

## 크레딧 예산 (Basic 70크레딧)

이미지 4장은 Nano Banana Pro 기준 장당 2크레딧, 영상 1편은 모델에 따라 7~45크레딧. 생성 전 웹앱의 생성 버튼에 표시되는 크레딧을 확인하고, 합계가 70을 넘지 않게 모델을 고른다.

## 진행 상태 (2026-09-27)

- Console 제품 정보 버전 3 저장·확인 완료. 이전 버전의 검토 상태였던 글은 규칙대로 초안으로 돌아갔다.
- Console 초안 6건 등록(모두 초안 상태, 게시 안 함).
- Higgsfield 웹앱(Basic)에서 Nano Banana Pro 1K 3:4 이미지 4장(각 2크레딧)과 Kling 3.0 720p 5초 9:16 영상 1편(10크레딧)을 만들었다. 합계 18크레딧 사용, 잔여 약 52.
- 사용자 승인 후 에셋 5개를 내려받아 이미지 4장을 초안 1~4에 첨부했다(각 버전 2, 형식 image). 원본은 git 제외 폴더 `.local/marketing/mellow-2026-09-27/`에 보관한다.
- 영상(`05-sofa-call.mp4`, 3.8 MB)은 Console이 이미지만 받으므로 초안 5에 첨부하지 못했다. 게시 시 수동 업로드하거나 영상 첨부 기능을 추가한 뒤 첨부한다.
- 검토·승인·게시는 하지 않았다. 다음 단계: 운영자가 초안 1~4의 이미지·문구를 검토 대기로 보내고 승인한 뒤 Buffer 경로로 게시.
