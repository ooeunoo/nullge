# nullge 공통 명령. 실제 구현은 package.json 스크립트와 Railway CLI이며, 이 파일은 하네스 규칙의 진입점만 제공한다.
# 대상이 없는 명령(모바일 ios/android/release-*)은 구현하지 않는다. 사용 불가로 둔다.
SHELL := /bin/bash
.DEFAULT_GOAL := help
RAILWAY_PROJECT := 3c584db8-6a84-4244-851d-0a4911e42674
SERVICES := web

.PHONY: help setup doctor site verify deploy storage-check credentials-check format format-check

help: ## 명령 목록
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

setup: ## 의존성 설치(마케팅 렌더링 스크립트·Prettier)
	pnpm install --frozen-lockfile

doctor: ## 도구 버전·설정 점검 (파일 변경 없음)
	@node -e 'const [m]=process.versions.node.split("."); if (+m<22) { console.error("Node 22+ 필요: "+process.version); process.exit(1);} console.log("node "+process.version)'
	@pnpm --version | sed 's/^/pnpm /'
	@command -v railway >/dev/null && railway --version || echo "railway CLI 없음: deploy 사용 불가"
	@python3 scripts/harness-config-check.py
	@python3 .harness/tools/credentials_check.py --project .

site: ## 회사 사이트 로컬 미리보기 (http://127.0.0.1:8080)
	pnpm site

format: ## Prettier로 소스 정리
	pnpm -s format

format-check: ## Prettier 형식 검사 (verify에 포함)
	pnpm -s format:check

storage-check: ## Git에 들어갈 임시 산출물·빌드 바이너리와 여유 공간 점검
	python3 .harness/tools/storage_check.py --project .

credentials-check: ## 추적 중인 .credentials 파일의 암호화 여부 점검
	python3 .harness/tools/credentials_check.py --project .

verify: doctor format-check storage-check ## 푸시 전 전체 검증

deploy: ## 운영 배포: make deploy SERVICE=web. GitHub 자동 배포는 사용하지 않는다.
	@if [ "$(SERVICE)" != "web" ]; then echo "배포 대상은 web 하나입니다: make deploy SERVICE=web"; exit 2; fi
	railway up --service web --detach
