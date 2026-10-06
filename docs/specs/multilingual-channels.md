# Spec: multilingual-channels

기능 ID `multilingual-channels` · 위치 `packages/contracts`, `packages/database`(연결·게시), `apps/api`, `apps/console`(채널·작성 화면)

## 목표

한 제품이 같은 SNS에 언어별 계정을 따로 연결한다(예: mellow Instagram 한국어 `@mellow.call.kr`, 영어 `@mellow.call`). 게시물의 언어가 게시할 계정을 정한다. 모든 제품이 같은 코드를 쓴다.

## 언어

`LANGUAGES = ko, en, ja, zh, es` (`packages/contracts`). 게시물·생성 요청·채널 연결이 같은 목록을 쓴다. 생성 기획은 이미 선택한 언어로 쓰므로 언어가 늘어도 프롬프트는 그대로다.

## 데이터

- `channel_connections.language text NOT NULL DEFAULT 'ko'`. 기본 키는 `(workspaceId, projectId, channel, language)`.
- 기존 연결은 모두 `ko`가 된다. 지금 연결된 계정(mellow `@mellow.call`, `@mellow_call`)은 한국어로 운영 중이다.
- `posts.language` 검사 조건을 `LANGUAGES`로 넓힌다.
- 토큰 암호화 문맥: `ko`는 기존 문자열 `channel:<w>:<p>:<channel>`을 그대로 쓰고, 다른 언어는 `:<language>`를 붙인다. 기존 암호문은 다시 암호화하지 않아도 그대로 풀린다.

## API (하위 호환)

- 채널 연결 요청 본문(`connect`, `buffer`, `disconnect`, `verify`, `authorize`)에 `language`를 더한다. 기본값은 `ko`라서 기존 호출은 그대로 동작한다.
- OAuth 언어는 봉인된 대기 상태에 저장하고 콜백에서 꺼낸다. 콜백 URL은 바꾸지 않는다.
- `GET projects/:slug/channels`는 연결된 모든 (채널, 언어) 행을 돌려준다. 채널에 행이 없으면 `ko` 빈 행을 넣는다. 각 행에 `language`가 있다.

## 게시

- 게시 요청과 게시 작업은 `(channel, post.language)` 연결을 쓴다. 그 언어 계정이 없으면 "영어 Instagram 계정을 먼저 연결해 주세요"로 막는다. 다른 언어 계정으로 대신 게시하지 않는다.
- 진행 중인 게시가 있으면 같은 채널·언어의 연결 변경을 막는다.

## Console

- 채널 화면은 (채널, 언어)마다 한 줄이다. 채널마다 "언어 계정 추가"로 다른 언어 줄을 만들고, 거기서 연결·Buffer 연결을 한다.
- 게시 패널과 목록은 게시물 언어에 맞는 계정을 보여 준다. 작성·자동 생성 화면의 언어 선택은 `LANGUAGES`를 쓴다.

## 완료 조건

- 기존 연결이 마이그레이션 뒤 `ko`로 남고, 기존 토큰이 그대로 풀린다(테스트).
- 같은 제품·채널에 ko·en 두 계정을 연결하고, 영어 게시물은 en 계정으로만 큐에 들어간다(테스트).
- en 계정이 없으면 영어 게시물 게시가 막힌다(테스트).
- OAuth 언어가 콜백까지 이어진다(테스트).
- 기존 테스트가 바뀌지 않고 통과한다(기본값 `ko`).
