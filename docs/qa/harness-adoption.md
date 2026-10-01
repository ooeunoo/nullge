# QA — 하네스 연결 정리 1단계

| 항목 | 내용 |
|---|---|
| 기능 | harness-adoption 1단계(문서·명령·검증·임시 파일) |
| 환경 | macOS, node v22.22.0, pnpm 10.33.2, PostgreSQL 16.10 로컬 5549, railway CLI 5.63.1 |
| 사전 데이터 | 없음(코드·운영 데이터 변경 없음) |

## 결과

| 검증 | 결과 |
|---|---|
| `make doctor` | 통과: node·pnpm·psql·railway 확인, harness.config 스키마 일치, credentials_check PASS |
| `make verify` | 통과: typecheck, vitest 9파일 71건, 전체 빌드, storage_check PASS (2026-10-01) |
| `python3 .harness/tools/storage_check.py --project .` | PASS, 삭제 없음 |
| `.harness/tools/adopt.py --project .` preview | actions 없음(기존 설정 유지) |
| Pages 워크플로 | 이번 푸시는 사이트 파일을 바꾸지 않으므로 실행되지 않아야 함 — 푸시 후 `gh run list`로 확인: 커밋 `a2d72d8` 푸시에서는 `pages.yml` 자체가 바뀌어 1회 실행됨(run 36832621330, 사이트 파일 동일). 이후 문서·코드 푸시에서 실행되지 않는지 다음 푸시에서 확인 |
| Railway | 푸시로 배포가 시작되지 않음 — `railway deployment list`에서 최신 배포가 2026-09-28 수동 배포임을 확인 |

## 정리

테스트 캡처·임시 미디어 없음. `.local/`은 Git 제외 상태 유지.

## 후속 정정 (같은 날)

- 첫 커밋이 `.harness/`를 gitlink(내장 저장소)로 추적했다. private 하네스를 public 저장소에 싣지 않도록 인덱스에서 제거하고 `.gitignore`에 추가했다. 스킬 링크(`.claude/skills`, `.agents/skills`)는 유지한다.
- `harness.config.json`·`docs/harness/platforms.json`에 하네스 스키마가 고정한 계정 이메일이 들어가 public 저장소에 푸시됐다. 이 저장소의 기존 결정(운영자 이메일은 Railway 변수에만)과 충돌하므로 처리 방식은 사용자 결정 대기(그대로 둘지, 파일에서 빼고 스키마를 완화할지, 이력 정리까지 할지).
