# nullge

Nullge 회사 사이트(정적, `index.html`·`assets/`)와 내부 마케팅 도구 Nullge Console(`apps/console` Next.js, `apps/api` NestJS, `apps/worker`, `packages/contracts`, `packages/database`)의 pnpm 모노레포다. Console 기획·운영 문서는 `docs/marketing/01`–`13`, 서비스별 마케팅 현황·진행 기록은 `docs/marketing/services/`(먼저 `services/README.md`와 해당 서비스 `README.md`를 읽고, 일이 진행되면 `README.md`와 `log.md`를 함께 고친다), 하네스 상태는 `docs/harness/`, 작업 계획은 `docs/plans/`, 검증 기록은 `docs/qa/`에 둔다. 문서 색인은 `docs/README.md`.

- `.harness/`는 private 저장소 `ooeunoo/harness`의 로컬 클론이며 이 공개 저장소에는 올리지 않는다(`harness.lock.json`으로 버전 고정, `.claude/skills`·`.agents/skills`는 그 안을 가리키는 링크). 새 클론에서는 `harness adopt --apply`로 복원한다.
- 명령: `make setup`, `make dev`(로컬 DB·API·Worker·Console), `make verify`(doctor·typecheck·test·build·storage-check), `make deploy SERVICE=<web|api|console|worker>`. 모바일 명령은 없다.
- 배포: GitHub 자동 배포는 없다. 공개 사이트(`web`)·Console·API·Worker 모두 `make deploy SERVICE=<web|api|console|worker>`(`railway up`)으로만 배포한다. `main` 푸시는 운영에 아무것도 배포하지 않는다.
- 비밀 값은 Railway 변수에만 두고 저장소는 공개이므로 문서·코드·커밋에 넣지 않는다. 운영자 개인 이메일도 적지 않는다.
- 생성 미디어·로컬 DB·캡처는 `.local/`(Git 제외) 또는 OS 임시 폴더(`.harness/tools/qa_temp.py`)에 두고 기능 종료 시 정리한다.
- mellow 마케팅 콘텐츠에는 AI 제작 고지 문구를 넣지 않는다(`docs/marketing/services/mellow/content/2026-09-27-content-plan.md`).

<!-- nullge-harness:begin -->
Read `.harness/AGENTS.md`, `harness.config.json`, and `docs/harness/state.json`.
Read `docs/harness/adoption.json` and `.harness/policies/adoption.md` before refactoring.
Preserve current service versions, identifiers, API/DB contracts, signing, billing and deployment.
Apply harness differences in feature-sized verified steps that do not change production behavior.
Existing instructions remain applicable; record conflicts rather than silently overriding them.
<!-- nullge-harness:end -->
