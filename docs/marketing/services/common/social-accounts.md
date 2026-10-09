# 제품별 SNS 계정 (한국어·영어) — 2026-10-03

운영자 요청: 제품마다 Instagram·Threads·X 계정을 한국어판과 영어판으로 하나씩 두고 로고와 프로필을 맞춘다.

## 역할 나눔

- **가입과 로그인은 운영자가 한다.** 계정 생성, 이메일·전화 인증, 보안 문자, 비밀번호 입력은 자동화하지 않는다. 비밀번호와 인증 수단은 저장소에 적지 않는다.
- 로그인된 브라우저에서 Claude가 이름·소개·링크·프로필 사진·X 배너를 넣는다. 저장 전에 계정별로 확인을 받는다.
- Threads 계정은 Instagram 계정으로 만든다. Instagram 계정 10개를 만들면 Threads는 같은 아이디로 이어진다.
- X 계정은 각각 다른 이메일 또는 전화번호가 필요하다.
- Instagram 웹에서는 웹사이트 링크를 바꿀 수 없다. 링크는 모바일 앱에서 운영자가 넣는다(`../mellow/content/2026-09-27-content-plan.md` 참고).

## 이미지

`node scripts/marketing/render-social-kit.mjs` → `.local/marketing/social-kit/<slug>/`

- `profile.png`: 1080×1080. 각 제품 저장소의 앱 아이콘이다. 원형으로 잘려도 로고가 남는다.
- `x-banner-ko.png`, `x-banner-en.png`: 1500×500. 브랜드 색 배경에 아이콘, 이름, 한 줄 문구를 넣었다. X 프로필 사진이 가리는 왼쪽 아래는 비워 두었다.

## 계정 표

아이디는 제안값이며 가입 때 사용 가능 여부를 확인한다. 이미 쓰이고 있으면 `.app`, `_official`, `hq` 같은 꼬리를 붙인다. X 아이디는 15자 이하다.

| 제품 | 언어 | Instagram·Threads | X | 표시 이름 | 링크 |
|---|---|---|---|---|---|
| ClipIt | ko | `clipit.kr` | `clipit_kr` | ClipIt 클립잇 | https://clipit.studio/ |
| ClipIt | en | `clipit.studio` | `clipitstudio` | ClipIt | https://clipit.studio/ |
| mellow | ko | `mellow.call_kr` (2026-10-06 생성) | — | mellow \| AI 전화 회화 | https://www.mellowcall.com/ |
| mellow | en | `mellow.call` (기존 계정을 글로벌로 전환) | `mellow_call` (기존) | mellow \| AI speaking practice | https://www.mellowcall.com/ |
| 다락방 카메라 | ko | `atticcamera.kr` | `atticcamera_kr` | 다락방 카메라 | https://atticcamera.nullge.com/ |
| 다락방 카메라 | en | `atticcamera.app` | `atticcamera_app` | Attic Camera | https://atticcamera.nullge.com/ |
| Kept | ko | `kept.bible.kr` | `keptbible_kr` | Kept 매일 성경과 기도 | https://kept.nullge.com/ |
| Kept | en | `kept.bible` | `keptbible` | Kept: Daily Bible & Prayer | https://kept.nullge.com/ |
| 두토리 | ko | `dotori.kr` | `dotori_kr` | 두토리 다정한 하루 플래너 | https://dotori.nullge.com/ko/ |
| 두토리 | en | `dotori.planner` | `dotoriplanner` | Dotori: Gentle Day Planner | https://dotori.nullge.com/ |

아이디 규칙(2026-10-06 운영자 결정): 글로벌(영어) 계정은 꼬리 없이, 한국어 계정은 `_kr`을 붙인다(`@nike` / `@nikekorea` 방식). mellow는 기존 `@mellow.call`을 영어 글로벌 계정으로 바꾸고 한국어 `@mellow.call_kr`을 새로 만들었다. 기존 한국어 게시물 4개는 `@mellow.call`에 그대로 남아 있다. 운영자가 이미 만든 Instagram 계정은 `clipit_studio`, `clipit_studio_kr`, `attic.camera`, `attic.camera_kr`이다. 다른 제품의 아이디는 이 이름에 맞춰 표를 고친다.

## 소개글

모든 문장은 각 제품의 프로필 사실(Console 제품 정보)에서만 가져왔다. 가격·출시 상태·무료 범위는 넣지 않았다. AI 제작 고지 문구도 넣지 않는다. 모두 150자 이하라서 Instagram·Threads·X 어디에나 그대로 쓴다.

**ClipIt · ko**
```
긴 영상 속 하이라이트를 AI가 찾아
제목·자막 붙인 세로 클립으로 ✂️
편집은 웹에서 바로
```
**ClipIt · en**
```
Long videos in, vertical clips out ✂️
AI finds the highlights, adds titles and captions.
Edit right in your browser.
```
**mellow · en**
```
Skip the textbook. Take the call. 📞
AI friends call you to practice speaking.
After each call: a talk report + phrases to review.
```
**다락방 카메라 · ko**
```
1970–2012 추억의 카메라 35대 📷
그 시절 색감으로 오늘을 찍어요
로그인·광고 없이, 사진은 내 폰에만
```
**Attic Camera · en**
```
35 cameras from 1970–2012 📷
Shoot today in the colors of then.
No login, no ads. Photos stay on your phone.
```
**Kept · ko**
```
읽고, 듣고, 기도해요. 조용히.
하루 10분: 본문 듣기 → 기도 → 감사 한 줄
광고도 가입도 없어요
```
**Kept · en**
```
Read, listen, pray. Quietly.
Your daily 10 minutes: listen, pray, give thanks.
No ads. No sign-up.
```
**두토리 · ko**
```
오늘은, 이만큼이면 충분해 🌰
할 일은 3–5개만, 못 한 일은 다정하게 내일로
말하듯 적으면 날짜·시간은 알아서
```
**Dotori · en**
```
Today, this much is enough 🌰
3–5 tasks a day. Unfinished ones gently move to tomorrow.
Type like you talk — dates and times just work.
```

주의: 두토리 무료 사용자에게는 목록 사이에 네이티브 광고가 보이므로 두토리 소개에는 "광고 없음"을 쓰지 않는다. Kept 한국어판은 한국어 성경 번역본을 약속하지 않는다.

## 진행 기록

| 날짜 | 계정 | 상태 |
|---|---|---|
| 2026-10-03 | 전체 | 이미지와 문구 준비 완료. 운영자 가입 대기 |
| 2026-10-06 | Instagram `@mellow.call_kr` | 한국어 소개(기존 `@mellow.call` 문구)와 프로필 사진 저장. 이름·링크는 앱에서 운영자가 넣는다 |
| 2026-10-06 | Instagram `@mellow.call` | 소개를 영어로 바꿈. 이름(`mellow \| AI 전화 회화`)은 그대로이고, 앱에서 영어 이름으로 바꾼다 |
| 2026-10-06 | Instagram `@mellow.call_kr` | 운영자 승인으로 프로페셔널(비즈니스) 계정 전환(카테고리 소프트웨어, 연락처 비공개), Buffer 권한 허용 |
| 2026-10-06 | Console mellow | Instagram 한국어 = Buffer `@mellow.call_kr`, Instagram 영어 = Buffer `@mellow.call`. X 한국어 = `@mellow_call`(그대로), Threads 미연결 |
