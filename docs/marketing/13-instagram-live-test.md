# mellow Instagram 실제 게시 테스트 · 2026-09-26

사용자가 Instagram 실제 게시 테스트 1건을 명시적으로 요청했다. 기존 게시 금지 제한은 이 1건에 한해 해제됐다. 유료 미디어 생성이나 반복 게시는 승인 범위에 포함하지 않는다.

## 준비한 콘텐츠

- 계정: Instagram `mellow.call`
- 기존 브랜드 이미지: `/Users/eun/projects/eun/mellow/assets/brand/social-1200x630.png`
- 이미지 확인: 1200 × 630, mellow 브랜드 로고와 “공부 말고, 통화할까요?” 문구. 개인 사진·비밀정보 없음. 새 유료 생성 불필요.
- 게시 문구:

> 공부 말고, 통화할까요? 🌿
>
> AI 캐릭터와 나누는 외국어 대화, mellow.
> 일상의 이야기를 말해 보고, 통화 후 리포트와 표현 복습으로 이어가세요.
>
> https://www.mellowcall.com/
> #mellow #외국어회화 #말하기연습

## 현재 결과

- Buffer 화면에서 `mellow.call` Instagram 채널, Queue 0, Drafts 0, Sent 0을 확인했다.
- Nullge의 Buffer 키는 저장 완료. 네이티브 Chrome 제어로 복구하여 mellow의 Instagram `mellow.call` 연결(13:54:45 KST)과 계정 검증(13:55:01 KST)을 완료했다.
- 브라우저 탭 debugger 제어는 불안정하지만 네이티브 Chrome 접근으로 운영 콘솔을 사용할 수 있다.
- 기존 Railway CLI를 이용한 읽기 전용 점검 스크립트 `scripts/check-buffer-live.mjs`를 추가했다. 비밀값은 출력하지 않는다. API 환경의 DB는 로컬에서 이름을 확인할 수 없는 내부 주소였고, Postgres 서비스에는 `DATABASE_PUBLIC_URL`이 없어 연결할 수 없었다. DB 외부 노출이나 새 SSH 접근 권한은 만들지 않았다.
- Buffer 작성 화면에 기존 이미지와 문구를 넣었으나 저장·예약·게시 버튼은 누르지 않았다. 사용자가 우리 서비스의 API 경로로 진행하라고 정정했으므로 이 작성 화면을 제출하지 않는다.
- 게시 요청은 0건이다. Buffer 작성·게시 API나 유료 생성 API를 호출하지 않았다.
- Nullge 이미지 첨부 기능을 운영 배포했다. 전체 62개 테스트, 타입 검사, 빌드가 통과했다. API/Worker/Console 배포 모두 SUCCESS이며 API 마이그레이션 완료를 확인했다.
- 제품 정보 버전 2의 저장소 근거를 다시 확인하고 검토 완료로 표시했다. [신규 테스트 초안](https://console.nullge.com/projects/mellow/marketing/9a92d122-f11f-46f3-87f1-24a874014633)에 위 제목·문구와 Instagram 채널을 저장했다. 게시 계정은 `@mellow.call`로 확인했다. 이미지는 아직 첨부되지 않아 그대로 게시하지 않는다.
- 재개 시 기존 Chrome 로그인을 그대로 사용할 수 있었다. 파일 선택 자동화는 `Not allowed`로 실패했고, 시스템 파일 선택창도 올바른 PNG를 선택한 상태에서 열기가 비활성화되어 취소했다. Chrome 확장 파일 URL 접근 설정을 사용자가 직접 켜거나 콘솔에 이미지를 직접 첨부해 달라고 요청했다. `chrome://extensions`는 브라우저 보안 정책으로 자동 접근이 차단되어 다른 경로로 우회하지 않았다. 권한 변경은 하지 않았다.

## 이어서 할 일

1. 사용자의 파일 URL 권한 설정 또는 직접 첨부 완료 후, 위 신규 Instagram 초안에 기존 이미지를 저장한다. 추가 로그인은 현재 필요하지 않다.
2. 업로드한 이미지·문구와 연결 계정을 운영 콘솔에서 확인한다.
3. 이후 게시 테스트는 반드시 Nullge → Buffer API → Instagram 경로로 진행한다. 제품 정보와 콘텐츠 검토를 거치고, 응답이 불확실하면 재게시하지 않고 기존 게시 상태부터 조회한다.
4. 성공 시 Instagram 게시물 URL을 기록한다. 기존 “실제 게시 금지” 초안은 수정하거나 게시하지 않는다.
