# 프로젝트 결정

공통 기준: `.harness/policies/service-defaults.md`.

| 날짜 | 항목 | 결정 | 이유 | 영향 기능·파일 |
|---|---|---|---|---|
| 2026-10-01 | 앱 구성 | web(site·console)·server(api)·worker, 모바일 없음 | 실제 저장소 구조 | `harness.config.json`, `docs/harness/adoption.json` |
| 2026-10-01 | 배포 방식 | Railway는 `railway up` 수동 배포 유지, GitHub 자동 배포 없음. 공개 사이트는 GitHub Pages이며 사이트 파일 변경 시에만 워크플로 실행 | 기능 푸시와 운영 배포 분리 | `Makefile deploy`, `.github/workflows/pages.yml` |
| 2026-10-01 | DB 엔진 | PostgreSQL(Railway Postgres, 로컬 16) | 기존 운영 | `harness.config.json deployment.databaseEngine` |
| 2026-10-01 | 저장소 공개 범위 | public 유지(전환 미결정) | 하네스 private 기본값과 다름; 사용자 결정 필요 | `docs/plans/harness-adoption.md` 3단계 |
| 2026-10-01 | 자격 증명 | Railway 변수만 사용, `.credentials/` 미사용 | 저장소가 public | `.gitignore`, `docs/harness/credentials.manifest.json` |
| 2026-10-01 | 언어 | 한국어 단일 유지 | 내부 도구·국내 회사 사이트; 다국어는 별도 기능 | `docs/harness/locales.json`(목표만 기록) |
| 2026-10-01 | 버전 | 출시 버전·태그 미운영; `0.1.0`은 자리값 | 이미 운영 중인 서비스의 첫 버전 결정 필요 | `harness.config.json service.version` |
| 2026-10-01 | 스키마 제약 | `mobile`·`telegram.enabled=true` 블록은 스키마 필수라 남겨 두고 사용하지 않음 | 하네스 스키마가 조건부 블록을 허용하지 않음 | `harness.config.json` |

계정·토큰의 비밀 값은 기록하지 않는다. 선택 앱, DB 엔진, locale 범위, 개발 식별자, 지원 버전, 자동 배포, 관리자 복구, 플랫폼 권한 등 프로젝트 결정만 추가한다.
