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

- 배포 뒤 마이그레이션 `ChannelLanguages1790985600000` 적용 로그와 기존 mellow 연결(`ko`)을 확인한다.
