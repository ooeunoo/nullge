# nullge

Nullge 회사 사이트(정적, `index.html`·`styles.css`·`assets/`, 서버는 `apps/site/server.mjs`) 저장소다. 내부 마케팅 도구 Nullge Console(API·Worker·DB)은 2026-11-11 운영자 요청으로 운영 서비스와 코드를 모두 삭제했다(코드는 Git 기록에만 남음). Console 기획·운영 문서 `docs/marketing/01`–`13`은 기록으로만 남긴다. 서비스별 마케팅 현황·진행 기록은 `docs/marketing/services/`(먼저 `services/README.md`와 해당 서비스 `README.md`를 읽고, 일이 진행되면 `README.md`와 `log.md`를 함께 고친다), 검증 기록은 `docs/qa/`에 둔다. 문서 색인은 `docs/README.md`.

- 명령: `make setup`, `make site`(로컬 미리보기), `make verify`(doctor·format-check), `make deploy SERVICE=web`. 모바일 명령은 없다.
- 배포: GitHub 자동 배포는 없다. `main` 푸시는 운영에 아무것도 배포하지 않는다.
  - **전용 서버**: `make deploy SERVICE=web`(= `make deploy-server`)이 `svc-nullge` LXC에 배포한다. 자세한 내용은 `deploy/README.md`에 있다. Railway 프로젝트는 2026-11-27 DNS 전환 후 삭제했다.
- 서버·인프라: 운영 서버 규칙은 private 저장소 `ooeunoo/nullge-infra`(로컬 `~/projects/eun/nullge-infra`)를 따른다. 서버 작업 전에 그 저장소의 AGENTS.md → docs/rules.md → docs/naming.md를 읽는다. 공용 영역(core-*, DNS)은 직접 바꾸지 않는다.
- 비밀 값은 서버의 `/srv/nullge/.env`에만 두고 저장소는 공개이므로 문서·코드·커밋에 넣지 않는다. 운영자 개인 이메일도 적지 않는다.
- 생성 미디어·로컬 DB·캡처는 `.local/`(Git 제외) 또는 OS 임시 폴더에 두고 기능 종료 시 정리한다.
- mellow 마케팅 콘텐츠에는 AI 제작 고지 문구를 넣지 않는다(`docs/marketing/services/mellow/content/2026-09-27-content-plan.md`).
