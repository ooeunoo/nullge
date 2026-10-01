# 하네스 연결 정리 계획

작성 2026-10-01. 정적 adopt(`harness adopt --apply`)는 완료됐고, 이 문서는 하네스 규칙과 현재 구현의 차이를 운영에 영향이 없는 순서로 정리하는 계획이다. 기존 기획·브랜드·출시 상태·데이터·API·인증·키는 보존한다.

## 현재 상태 (2026-10-01 확인)

| 항목 | 확인 결과 |
|---|---|
| 저장소 | `ooeunoo/nullge` **public** (gh repo view). 하네스 기본값은 private |
| 앱 | `apps/site`(정적 공개 사이트), `apps/console`(Next.js 16), `apps/api`(NestJS), `apps/worker`, `packages/contracts`, `packages/database`. 모바일 없음. adopt가 `apps: ["worker"]`로 감지한 것을 `web/server/worker`로 정정 |
| 배포 | Railway 프로젝트 `3c584db8…`, 서비스 web/api/console/worker/Postgres, 환경 production 하나. 서비스에 GitHub source 없음 → **Railway 자동 배포 없음**, `railway up`만 사용 |
| 공개 사이트 | DNS `www.nullge.com` → GitHub Pages. `.github/workflows/pages.yml`이 **main 푸시마다** 사이트를 재배포함(최근 3회 모두 docs/console 변경에 반응). Railway `web` 서비스는 준비만 됨 |
| 버전 | root package에 version 없음, 태그 없음. `harness.config.json`의 0.1.0은 CLI 입력값 |
| 비밀 | Railway 변수에만 있음. `.credentials/` 없음, `.gitignore`가 `.credentials/`를 제외(하네스는 git-crypt 암호화 후 커밋) |
| 언어 | 사이트·Console 모두 한국어. 하네스 기본은 영어 원본·다국어 |
| 검증 | `pnpm typecheck`, `pnpm test`(vitest 71건, 로컬 PostgreSQL 5549), Makefile 없음 |
| 임시 산출물 | 생성 미디어·로컬 DB는 `.local/`(Git 제외), 스크립트 생성물은 `scripts/marketing/.gitignore`. storage_check PASS |
| 코드 컨벤션 | kebab-case 파일, UI 컴포넌트가 `console.tsx`/`marketing.tsx`(하네스는 PascalCase), ESLint/Prettier 없음, 통합 테스트가 루트 `tests/` |

## 1단계 — 문서·명령·검증·임시 파일 (운영 동작 변화 없음) — 완료

| # | 변경 | 동작 영향 | 검증 | 복구 |
|---|---|---|---|---|
| 1-1 | `harness.config.json` 앱·저장소·Railway ID·DB 엔진을 실제 값으로 정정, `scripts/harness-config-check.py`로 스키마 검증 | 없음(설정 파일) | `make doctor` | 파일 되돌리기 |
| 1-2 | `docs/harness/platforms.json`·`adoption.json`에 CLI로 확인한 비밀 아닌 ID·검증 방법 기록 | 없음 | 수동 대조 | 되돌리기 |
| 1-3 | `Makefile`: setup/doctor/dev/verify/test/typecheck/build/storage-check/credentials-check/deploy(SERVICE 필수). 기존 pnpm 스크립트를 감싸기만 함 | 없음 | `make help`, `make doctor`, `make verify` | 파일 삭제 |
| 1-4 | `AGENTS.md`에 프로젝트 요약·명령·배포 규칙·임시 파일 규칙 추가, `docs/README.md` 색인으로 하네스 폴더와 기존 `docs/marketing` 연결 | 없음 | 링크 확인 | 되돌리기 |
| 1-5 | `.github/workflows/pages.yml`에 `paths` 필터: 공개 사이트 파일이 바뀐 푸시에서만 Pages 배포. 사이트 내용·DNS는 그대로 | 배포 **횟수**만 감소, 사이트 내용 동일 | 이번 푸시(사이트 파일 변경 없음)에서 워크플로가 실행되지 않음을 `gh run list`로 확인; 실행이 필요하면 `workflow_dispatch` | 필터 제거 |
| 1-6 | 상태 기록: `state.json`, `decisions.md`, `docs/qa/harness-adoption.md` | 없음 | — | — |

## 2단계 — 검증 후 기능별 정리 (동작 보존, 별도 커밋)

| # | 변경 | 위험 | 검증 |
|---|---|---|---|
| 2-1 | UI 컴포넌트 파일을 PascalCase로 바꾸고 `console.tsx`(약 1,000줄)를 기능별 `apps/console/src/features/*`로 분리 | import 경로 변경, Next 빌드 | `make verify` + Claude in Chrome으로 콘텐츠 목록·편집·설정 화면 확인 |
| 2-2 | 통합 테스트를 `apps/api/test/`로 이동하거나 루트 유지 결정 기록 | 테스트 경로만 | `pnpm test` |
| 2-3 | Prettier + ESLint 도입(포맷 변경 커밋과 로직 변경 커밋 분리) | diff 노이즈 | 포맷 전후 typecheck·test 동일 |
| 2-4 | `scripts/*.mjs` 중 일회성 점검 스크립트 정리·문서화 | 없음 | 사용 여부 확인 |
| 2-5 | `docs/qa/` 기능별 기록 양식 적용, Chrome UI 검증 시 `qa_temp.py` 경로 사용 | 없음 | 다음 기능부터 |

## 3단계 — 전환 명세 필요 (하네스 일치 작업으로 바꾸지 않음)

| 항목 | 현재 | 하네스 | 필요한 결정·검증 |
|---|---|---|---|
| 저장소 공개 범위 | public | private | 공개 사이트 소스·외부 링크 영향, GitHub Pages는 private 저장소에서 유료 플랜 필요. 사용자 결정 |
| 자격 증명 | Railway 변수만, `.credentials/` 미사용·ignore | git-crypt 암호화 커밋 | 저장소가 public인 동안은 암호화 파일도 커밋하지 않는 것이 안전. private 전환과 함께 결정 |
| 공개 사이트 호스팅 | ~~GitHub Pages~~ → 2026-10-01 Railway `web`으로 전환 완료(사용자 지시) | Railway `web` + 수동 배포 | 캐시 만료 후 Pages 워크플로·사이트 제거 |
| 서비스 버전·출시 기록 | 없음 | `1.0.0`부터 patch, `docs/releases/<v>.md`, 태그 | 첫 출시 버전을 무엇으로 볼지(이미 운영 중) 결정 후 태그 |
| 언어 | 한국어 단일 | 영어 원본·다국어·`docs/harness/locales.json` | 내부 도구와 회사 사이트의 대상 언어 결정. 사용자 화면 변경이므로 기능 단위 |
| Telegram 운영 알림 | 없음 | 서비스별 봇·채널 | 필요 이벤트 정의 후 nullge-telegram |
| 관리자·결제·모바일 | 없음 | 조건부 | 해당 없음. 스키마가 `mobile`·`telegram.enabled=true` 블록을 요구해 설정 파일에는 남아 있으나 사용하지 않음(결정 기록) |
| API/DB 구조 | 루트 `tests/`, `packages/database`에 migration | `apps/server/src/modules`, `apps/*/test` | 폴더 이동은 2단계로 가능하나 API 계약·DB는 변경 없음 |

## 검증 방법

- 각 단계 후 `make verify`(doctor, typecheck, vitest 71건, build, storage_check)와 `make credentials-check`.
- 푸시 전 `gh run list`로 Pages 워크플로 실행 여부, `railway deployment list --service <svc> --json`으로 Railway가 반응하지 않았음을 확인.
- UI 변경(2-1)은 Claude in Chrome으로 `console.nullge.com` 또는 로컬 `127.0.0.1:4310`에서 목록·편집·설정 흐름을 확인하고 캡처는 qa_temp 경로에서 삭제.
