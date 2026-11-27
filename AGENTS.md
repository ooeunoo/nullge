# nullge

Nullge 회사 사이트(정적, `index.html`·`styles.css`·`assets/`, 서버는 `apps/site/server.mjs`) 저장소다. 내부 마케팅 도구 Nullge Console(API·Worker·DB)은 2026-11-11 운영자 요청으로 운영 서비스와 코드를 모두 삭제했다(코드는 Git 기록에만 남음). Console 기획·운영 문서 `docs/marketing/01`–`13`은 기록으로만 남긴다. 서비스별 마케팅 현황·진행 기록은 `docs/marketing/services/`(먼저 `services/README.md`와 해당 서비스 `README.md`를 읽고, 일이 진행되면 `README.md`와 `log.md`를 함께 고친다), 검증 기록은 `docs/qa/`에 둔다. 문서 색인은 `docs/README.md`.

- 명령: `make setup`, `make site`(로컬 미리보기), `make verify`(doctor·format-check), `make deploy SERVICE=web`. 모바일 명령은 없다.
- 배포: GitHub 자동 배포는 없다. Railway `nullge` 프로젝트에는 `web` 서비스 하나만 있고 `make deploy SERVICE=web`(`railway up`)으로만 배포한다. `main` 푸시는 운영에 아무것도 배포하지 않는다.
- 비밀 값은 Railway 변수에만 두고 저장소는 공개이므로 문서·코드·커밋에 넣지 않는다. 운영자 개인 이메일도 적지 않는다.
- 생성 미디어·로컬 DB·캡처는 `.local/`(Git 제외) 또는 OS 임시 폴더에 두고 기능 종료 시 정리한다.
- mellow 마케팅 콘텐츠에는 AI 제작 고지 문구를 넣지 않는다(`docs/marketing/services/mellow/content/2026-09-27-content-plan.md`).
