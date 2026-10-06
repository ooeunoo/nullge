# QA: multilingual-channels

명세: `docs/specs/multilingual-channels.md`

## 2026-10-06 로컬

- `make verify` 통과: 테스트 95개(12개 파일), 타입 검사, 빌드, 형식 검사, 저장 공간 검사.
- 새 테스트 `tests/channel-languages.test.ts`(4개):
  - 마이그레이션 전 모양과 암호화 문맥으로 저장한 연결이 `ko`로 보이고 토큰이 그대로 풀린다.
  - 같은 제품·채널에 ko·en 계정을 함께 연결한다. 연결이 없는 채널은 빈 `ko` 줄을 보여 준다.
  - 영어 게시물은 en 계정 스냅샷으로 큐에 들어가고, 게시 요청에는 en 토큰만 쓰인다. 큐에 있는 동안 en 계정 연결 변경이 막힌다.
  - 일본어 계정이 없으면 일본어 게시물은 "일본어 Threads 계정을 먼저 연결해 주세요"로 막히고 작업이 생기지 않는다.
- `tests/marketing-oauth.test.ts`: OAuth를 `en`으로 시작하면 콜백 뒤 en 줄에 연결되고, `:en` 문맥으로 암호화된다.
- 기존 테스트는 바꾸지 않았다(언어 기본값 `ko`).
- 로컬 Console 채널 화면: 채널마다 언어 배지가 보이고, "언어별 계정 추가"로 Instagram 영어 줄을 추가했다. 추가한 언어는 선택지에서 비활성화된다. 캡처 파일은 남기지 않았다.

## 운영

- 2026-10-06 배포: 커밋 `72645e2`, API `dfaf22f0`, Worker `09be2d47`, Console `35756e6e` 모두 SUCCESS. API 로그 "Console migrations applied." / "Nullge API ready.".
- 운영 `GET projects/mellow/channels`: X `@mellow_call`(직접)과 Instagram `@mellow.call`(Buffer)이 `ko` 연결로 그대로 남았고, Threads는 미연결 `ko` 줄이다. 유료 요청과 게시는 하지 않았다.
