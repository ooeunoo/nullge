# nullge 공통 명령. 실제 구현은 package.json 스크립트와 Railway CLI이며, 이 파일은 하네스 규칙의 진입점만 제공한다.
# 대상이 없는 명령(모바일 ios/android/release-*)은 구현하지 않는다. 사용 불가로 둔다.
SHELL := /bin/bash
.DEFAULT_GOAL := help
RAILWAY_PROJECT := 3c584db8-6a84-4244-851d-0a4911e42674
SERVICES := web api console worker

.PHONY: help setup doctor dev db verify test typecheck build deploy storage-check credentials-check

help: ## 명령 목록
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

setup: ## 의존성 설치와 공유 패키지 빌드
	pnpm install --frozen-lockfile
	pnpm --filter @nullge/contracts build
	pnpm --filter @nullge/database build

doctor: ## 도구 버전·설정 점검 (파일 변경 없음)
	@node -e 'const [m]=process.versions.node.split("."); if (+m<22) { console.error("Node 22+ 필요: "+process.version); process.exit(1);} console.log("node "+process.version)'
	@pnpm --version | sed 's/^/pnpm /'
	@command -v psql >/dev/null && psql --version || echo "psql 없음: 로컬 DB(pnpm dev:db)와 테스트는 PostgreSQL 16+가 필요"
	@command -v railway >/dev/null && railway --version || echo "railway CLI 없음: deploy 사용 불가"
	@python3 scripts/harness-config-check.py
	@python3 .harness/tools/credentials_check.py --project .

dev: ## 로컬 DB·API·Worker·Console 실행 (127.0.0.1:4310)
	pnpm dev

typecheck: ## 전체 타입 검사
	pnpm typecheck

db: ## 로컬 PostgreSQL(127.0.0.1:5549, .local/postgres) 시작
	pnpm dev:db

test: db ## 통합 테스트 (로컬 PostgreSQL을 먼저 띄움)
	pnpm test

build: ## 모든 워크스페이스 빌드
	pnpm build

storage-check: ## Git에 들어갈 임시 산출물·빌드 바이너리와 여유 공간 점검
	python3 .harness/tools/storage_check.py --project .

credentials-check: ## 추적 중인 .credentials 파일의 암호화 여부 점검
	python3 .harness/tools/credentials_check.py --project .

verify: doctor typecheck test build storage-check ## 푸시 전 전체 검증

deploy: ## 운영 배포: make deploy SERVICE=api (web|api|console|worker). GitHub 자동 배포는 사용하지 않는다.
	@if [ -z "$(SERVICE)" ]; then echo "SERVICE를 지정하세요: make deploy SERVICE=api"; exit 2; fi
	@case " $(SERVICES) " in *" $(SERVICE) "*) ;; *) echo "알 수 없는 서비스: $(SERVICE)"; exit 2;; esac
	railway up --service $(SERVICE) --detach
