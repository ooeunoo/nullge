# mellow 콘텐츠 기획 · 2026-09-27

작성 근거: `~/projects/eun/mellow` 2026-08-15 이후 163개 커밋, `store/listing.md`, `docs/deployment.md`, `packages/core/src/marketing/marketing-policy.ts`, `docs/marketing/content.json`. Console 제품 정보는 버전 3으로 갱신·확인 완료.

## 전제

- 공개 버전 기준으로만 말한다. ~~영어·일본어·중국어·스페인어, AI 친구 11명~~ → 2026-10-10부터 8개 언어·AI 친구 19명(개발자 확인, `../README.md`).
- 미디어는 Higgsfield 웹앱(Basic, 월 70크레딧)에서 만든다. API 잔액은 아직 없으므로 Console 자동 생성은 쓰지 않는다.
- 캡션에 "AI로 제작한 이미지입니다" 같은 고지 문구는 넣지 않는다(운영자 결정, 2026-09-27 밤). Instagram의 AI 레이블 토글은 켠다. 실제 앱 화면을 흉내 낸 가짜 UI, 읽히는 텍스트·로고는 만들지 않는다.
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

## 시각 방향 (2026-09-27 수정)

첫 시안 4장은 브랜드와 무관한 스톡 사진처럼 나와 폐기했다. mellow의 확립된 룩(`output/marketing/2026-09-09/instagram-after-work-poster-v1.png`, `prompts.json`)을 기준으로 다시 정했다.

- 사진: 가상의 한국인 성인, 저녁 집안·퇴근길·아침 카페 같은 실제 장면, 따뜻한 실내등, 차콜 의상, 은은한 초록 액센트. 화면·텍스트·로고 없음. 상단 1/4은 카피용 여백.
- 포스터: 사진 위에 어두운 그라데이션, 흰색+라임(`#c6ed82`) 두 줄 헤드라인, 보조 문장, 하단에 `mellow` 워드마크(light)와 "먼저 전화하는 AI 친구". 고지 문구 없음. 1080×1350(4:5).
- 렌더 스크립트: `scripts/marketing/render-mellow-poster.mjs <사진> <1행> <2행> <보조문장> <출력.png>` (헤드리스 Chrome).

| # | 헤드라인 | 보조 문장 |
| --- | --- | --- |
| 1 | 앱을 닫아 두어도, / 전화는 옵니다. | 내가 정한 시간에 AI 친구가 먼저 전화해요. |
| 2 | 귀에 대면, / 화면은 꺼져요. | 그냥 전화하듯 말하면 돼요. 조금 서툴러도, 대화는 계속. |
| 3 | 오늘의 장면, / 카페에서 주문하기. | 원하는 장면을 적으면 그 상황으로 통화해요. |
| 4 | 막혔던 문장은, / 카드로 돌아와요. | 내 녹음과 AI 예시 발음을 번갈아 들어요. |

## 미디어 프롬프트 (Higgsfield 웹앱)

이미지 비율 4:5, 영상 9:16 5초. 사람은 가상의 성인, 얼굴은 자연스럽게, 텍스트·로고·화면 UI 없음.

1. A smartphone lying face-down on a warm wooden desk in a cozy evening apartment, soft lime-green glow spilling from under the phone as if ringing, blurred lamp and a mug in the background, editorial product photography, no text, no screen visible.
2. A young adult walking along a quiet Seoul side street at dusk, holding a phone to the ear with a relaxed smile, warm street lights, shallow depth of field, phone screen not visible, candid editorial photo, no text.
3. A friendly barista in her late twenties behind a cozy Seattle café counter, smiling and handing over a paper cup, warm morning light, espresso machine and pastries blurred, editorial lifestyle photo, no readable text or logos.
4. Morning desk scene with a small stack of blank index cards, a pen, wireless earbuds and a phone face down, soft sunlight, pale paper tones with a lime-green accent, minimal editorial still life, no text.
5. (영상) A young adult sitting on a sofa at home in the evening, phone at ear, pauses thoughtfully then smiles and nods, subtle slow push-in, warm lamp light, vertical, no on-screen text.

브랜드 색 참고: paper `#faf9f5`, charcoal `#212620`, lime `#c6ed82`, green `#78a547`.

## 영상 (2026-09-27)

- 초안 5는 "퇴근길에 걸려온 회화 전화"로 바꿨다. 사용자 선택: 퇴근길 장면, 실제로 벨을 받고 통화를 시작하는 흐름, 광고가 아니라 실제 촬영 같은 느낌.
- Kling 3.0, 5초, 9:16, 720p, 오디오 켬(10크레딧). 종료 프레임만 지정하면 시작 프레임이 필수라는 오류가 나서 프레임 없이 텍스트로 생성했다. 프롬프트 핵심: 친구가 폰으로 찍은 듯한 핸드헬드, 폰이 울림 → 확인 → 웃으며 받음 → 통화, 서울 골목 해질녘, 차콜 코트, 화면·텍스트·로고 없음.
- 마감: `scripts/marketing/finish-mellow-video.sh <원본> "조금 서툴러도," "대화는 계속." <출력>` → 1080×1920, 상단 그라데이션 위 흰색+라임 카피(0.4~4.6초), 좌하단 "AI 모델로 연출한 영상", 2초 브랜드 엔드카드(종이색 배경, 워드마크, "공부 말고, 통화할까요?", mellowcall.com). 원본 오디오 유지, 총 7초.
- 첫 완성본 `05-street-call-final.mp4`(7초)를 초안 5에 첨부한 뒤, 사용자 요청으로 두 가지를 더했다: 벨이 울릴 때 브랜드 알림 카드("mellow · Emma에게서 전화가 왔어요 · 예약한 저녁 7시 · 영어 회화", 앱 화면 모사가 아닌 그래픽 토스트)와 받은 뒤 짧은 대화. 첫 클립의 마지막 프레임을 시작 프레임으로 올려(사용자가 Higgsfield 업로드 동의) 같은 인물이 이어서 통화하는 5초 클립을 추가 생성했다(10크레딧, 누적 46, 잔여 약 24).
- 최종본 `05-street-call-v2.mp4`(12초, 6.5 MB): 클립1(그라데이션, 0.5~2.3초 맥동하는 알림 카드, 3초부터 헤드라인) + 클립2(헤드라인 유지, 하단 대화 자막 Emma "Hey! How was your day?" / 나 "Long day... but good." / Emma "Tell me about it!" 영어+한국어) + 엔드카드 2초. 사용자 요청으로 "AI 모델로 연출한 영상" 문구는 본편·엔드카드에서 제거했다. Instagram 게시 시 Buffer 연동의 AI 생성 플래그는 유지된다.
- 스크립트: `scripts/marketing/finish-mellow-call-video.sh <클립1> <클립2> <출력>`. 자막 문구는 `scripts/marketing/mellow-call-sub/*.txt`에서 바꾼다. 초안 5에 최종본을 교체 첨부했다. 원본과 결과는 `.local/marketing/mellow-2026-09-27/v2/`.

## 영상 시리즈 (2026-09-27 저녁 결정)

- 규칙: 모든 영상은 "띠링 차임 + 브랜드 알림 카드 → 받는다 → 통화" 오프닝을 공유하고 뒤 장면만 바꾼다. 10초(5초 클립 2개, 두 번째는 첫 클립 마지막 프레임을 시작 프레임으로 이어 생성) + 엔드카드 2초. 대사 자막 없음, 실제 촬영 느낌, 편당 20크레딧.
- 후보와 헤드라인: A 저녁 부엌 스피커폰(손은 바빠도, / 입은 한가하니까.), B 카페 주문 연습→실제 주문(방금 연습한 문장, / 바로 씁니다.), C Aoi 일본어 전화(오늘은 일본어로, / Aoi와.), D 침묵 체크인(막혀도 괜찮아요, / 친구가 먼저 말해요.), E 아침 첫 통화(오늘 첫 문장은, / 영어로.), F 통화 뒤 복습 카드(통화 뒤에는, / 표현 한 번 더.).
- 사용자 선택: A 먼저. 초안 7 "손은 바빠도, 입은 한가하니까"(Instagram 영상)로 등록하고 `07-kitchen-call-final.mp4`(12초, 4.7 MB)를 첨부했다. 클립 2개 20크레딧 사용, 누적 66, 잔여 약 4. 다음 편(B 추천)은 API 잔액 충전 또는 다음 달 크레딧으로 진행한다.
- 편집 명령: `scripts/marketing/finish-mellow-call-video.sh <클립1> <클립2> <출력> "손은 바빠도," "입은 한가하니까."`

## 크레딧 예산 (Basic 70크레딧)

이미지는 Nano Banana Pro 기준 장당 2크레딧, 영상은 Kling 3.0 5초 기준 10크레딧(Seedance 2.5는 60). 생성 전 웹앱의 생성 버튼에 표시되는 크레딧을 확인하고, 합계가 70을 넘지 않게 모델을 고른다.

## 진행 상태 (2026-09-27)

- Console 제품 정보 버전 3 저장·확인 완료. 이전 버전의 검토 상태였던 글은 규칙대로 초안으로 돌아갔다.
- Console 초안 6건 등록(모두 초안 상태, 게시 안 함).
- Higgsfield 웹앱(Basic)에서 Nano Banana Pro 1K 3:4 이미지 4장(각 2크레딧)과 Kling 3.0 720p 5초 9:16 영상 1편(10크레딧)을 만들었다. 합계 18크레딧 사용, 잔여 약 52.
- 사용자 승인 후 에셋 5개를 내려받아 이미지 4장을 초안 1~4에 첨부했다(각 버전 2). 이 첫 시안은 브랜드와 맞지 않아 폐기했다(원본은 `.local/marketing/mellow-2026-09-27/`).
- 시각 방향을 다시 정한 뒤 브랜드 룩 사진 4장을 추가 생성(8크레딧, 누적 26, 잔여 약 44)하고 포스터로 렌더링해 초안 1~4의 이미지를 교체했다(각 버전 3). 포스터와 사진 원본은 `.local/marketing/mellow-2026-09-27/v2/`.
- 첫 영상(`05-sofa-call.mp4`, 소파 통화)은 방향 변경으로 쓰지 않았다. 새 퇴근길 영상은 위 '영상' 절 참고. 누적 크레딧 36, 잔여 약 34.
- 검토·승인·게시는 하지 않았다. 다음 단계: 운영자가 초안 1~4의 이미지·문구를 검토 대기로 보내고 승인한 뒤 Buffer 경로로 게시.

## 채널 프로필 (2026-09-27 저녁)

세 채널의 프로필을 같은 문구로 맞췄다. 이름은 `mellow | AI 전화 회화`, 프로필 사진은 `mellow/assets/brand/app-icon-1024.png`, 링크는 `https://www.mellowcall.com/`. 언어는 운영자 결정으로 1.0.3 기준 8개를 적는다.

소개(세 채널 공통):

```
먼저 전화하는 AI 친구, mellow 📞
정한 시간에 전화가 오면 받아서 이야기하세요.
영어·일본어·중국어·스페인어·프랑스어·독일어·포르투갈어·한국어, 8개 언어
공부 말고, 통화할까요?
```

- X `@mellow_call`: 이름·소개·링크·프로필 사진·배너(1500×500, "공부 말고, 통화할까요?" 문구 + 워드마크, 로컬 렌더링) 모두 설정.
- Threads `@mellow.call`: 소개 교체, 프로필 사진 업로드. 링크는 이미 mellowcall.com.
- Instagram `@mellow.call`: 소개 교체. 웹사이트 링크 입력란은 웹에서 `disabled`로 잠겨 있어(안내문: "링크 수정은 모바일에서만 가능합니다") 앱에서 직접 넣어야 한다.

## 첫 게시 (2026-09-27 밤, 웹에서 직접)

Console 초안의 문구를 그대로 쓰되 각 채널 웹 UI에서 직접 올렸다(Buffer 경로 아님). Console 초안 상태는 바꾸지 않았다.

| 채널 | 게시물 | 미디어 |
| --- | --- | --- |
| Instagram | 릴스 "퇴근길에 걸려온 회화 전화" (AI 레이블 켬, 소리 켬) | `v2/05-street-call-v4.mp4` |
| Instagram | "앱을 닫아 두어도, 전화는 옵니다" (AI 레이블 켬) | `v2/01-poster.png` (모서리 문구 있는 판) |
| Instagram | "귀에 대면, 화면은 꺼져요" (AI 레이블 켬) | `v2/02-poster.png` (모서리 문구 있는 판) |
| Threads | "오늘은 누구랑 통화할까요?" — 8개 언어로 고쳐 씀, 친구 수는 적지 않음 | 없음 |
| Threads | "오늘의 장면, 카페에서 주문하기" (삭제 후 재게시) | `v3/03-poster.png` |
| X | "막혔던 문장은, 카드로 돌아와요" (삭제 후 재게시) | `v3/04-poster.png` |
| X | "귀에 대면, 화면은 꺼져요" (삭제 후 재게시) | `v3/02-poster.png` |

게시 직후 운영자가 "AI로 제작한 이미지/영상입니다" 줄을 빼라고 해서 7건 모두에서 지웠다. Instagram 3건은 캡션 수정, Threads·X는 수정이 안 되어(Threads는 15분 창 경과, X는 무료 계정) 삭제하고 다시 올렸다. 포스터도 모서리 문구를 뺀 `v3`로 다시 렌더링했다. Instagram 포스터 2건은 이미지를 바꿀 수 없어 `v2`(모서리 문구 있음) 그대로다.

- X에는 영상(`07-kitchen-call-v2.mp4`)을 먼저 올리려 했으나 웹 작성창의 영상 미리보기가 끝나지 않아 이미지 글로 바꿨다. 부엌 영상은 아직 어느 채널에도 게시하지 않았다.
- 웹 UI 메모: Instagram 웹은 파일 입력에 파일을 넣어도 반응이 늦을 수 있고, 영상은 자동으로 릴스가 된다. X 웹은 미디어를 붙인 뒤 본문을 입력해야 본문이 남는다.

## 정리 (2026-09-28 낮)

- 운영자가 Console에서 Buffer로 "퇴근길" 릴스(3번 시도 끝에 성공)와 "손은 바빠도" 릴스를 게시했다. 그 결과 Instagram에 퇴근길 릴스가 둘 있어, 전날 웹에서 직접 올린 쪽(`DdywfWDN1Ai`)을 지우고 Buffer 쪽(`Ddy0q3KgW_e`)을 남겼다. 두 Buffer 릴스의 캡션에서 AI 고지 줄을 지웠다.
- Console: 실패한 퇴근길 중복 3건 삭제. 직접 올린 5건(카드→X, 카페→Threads, 오늘은 누구랑→Threads, 귀에 대면→Instagram, 앱을 닫아 두어도→Instagram)은 채널·문구를 실제 게시물에 맞춘 뒤 `published` 기록으로 잠갔다. X에 같이 올린 "귀에 대면" 글(`2104213173020901812`)은 Console 기록이 없다(Instagram 기록과 같은 콘텐츠).
- 남은 초안: "매일 외국어 대화, Mellow와 함께"(Threads 글), "공부 말고, 통화할까요?"(Instagram 글). 부엌 영상은 Instagram에 게시됐고 X·Threads에는 아직 없다.
- 현재 채널 상태: Instagram 4건(릴스 2, 포스터 2), Threads 2건, X 2건.
