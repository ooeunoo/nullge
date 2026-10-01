# scripts

| 스크립트 | 용도 | 상태 |
|---|---|---|
| `dev.mjs` | 로컬 DB·공유 패키지 빌드·마이그레이션·시드 후 API/Worker/Console 실행 (`make dev`) | 사용 중 |
| `local-db.mjs` | `.local/postgres`에 PostgreSQL 16 인스턴스를 만들고 127.0.0.1:5549로 띄움 (`make db`) | 사용 중 |
| `migrate.mjs` | Railway API 서비스 predeploy: migrate + bootstrap | 운영 사용 중 |
| `start.mjs` | 컨테이너 시작점. `NULLGE_SERVICE`로 console/api/worker 선택 | 운영 사용 중 |
| `harness-config-check.py` | `harness.config.json`을 하네스 스키마로 검증 (`make doctor`) | 사용 중 |
| `check-ui.mjs` | 개발 서버에 대한 로컬 브라우저 스모크 테스트(독립 Chrome 프로필) | 수동 점검용 |
| `check-oauth-http.mjs` | 일회용 로컬 DB와 루프백 서버로 OAuth HTTP 흐름 점검(가짜 앱 ID) | 수동 점검용 |
| `check-buffer-live.mjs` | Railway CLI로 Buffer 연결 상태 읽기 전용 점검 | 수동 점검용 |
| `import-mellow-marketing.mjs` | mellow 저장소의 기존 마케팅 데이터 1회 이관 (2026-09 완료) | 완료, 보관 |
| `import-mellow-openai.mjs` | mellow의 OpenAI 키를 Console 설정으로 1회 재사용 (2026-09 완료) | 완료, 보관 |
| `marketing/` | mellow 포스터·영상 마무리 렌더링. 생성된 PNG/WAV는 첫 실행 때 다시 만들어지며 Git 제외 | 사용 중 |

점검 스크립트는 자격 증명을 출력하지 않는다. 임시 산출물은 OS 임시 폴더나 `.local/`에만 둔다.
