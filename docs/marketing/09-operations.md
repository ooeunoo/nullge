# 개발·배포·도메인 전환 운영 절차

## 로컬 개발

Node 22+, pnpm 10.33.2, PostgreSQL 명령어(`initdb`, `pg_ctl`, `psql`)가 필요하다.

```sh
cd /Users/eun/projects/eun/nullge
pnpm install --frozen-lockfile
pnpm dev
```

Console: `http://127.0.0.1:4310`, API: `127.0.0.1:4311`, DB: `127.0.0.1:5549/nullge_console`.

로컬 DB 데이터는 `.local/postgres`에 저장한다. 다른 제품 DB/서버와 포트를 공유하지 않는다. `pnpm dev`는 loopback의 `nullge_*` DB만 허용한다. 기본 DB는 trust 인증이므로 외부 인터페이스나 운영에 사용하지 않는다.

`.env.example`은 개발용 예시다. 실비밀은 `.env`에만 저장하고 커밋하지 않는다. 환경파일이 없으면 로컬 기본값으로 실행한다. 초기 프로필 seed는 기존 편집 내용을 덮어쓰지 않는다.

```sh
pnpm typecheck
pnpm test
pnpm build
```

테스트에는 로컬 Postgres가 필요하다(`pnpm dev:db`). 운영 URL을 테스트 DB로 넣지 않는다. 프런트엔드 개발 서버와 빌드를 함께 실행해 산출물이 충돌했다면 개발 서버를 재시작한다.

개발 서버 실행 중 macOS Chrome으로 `node scripts/check-ui.mjs`를 실행하면 독립된 테스트 브라우저에서 로컬 로그인·화면·로그아웃을 확인한다. 스크린샷은 `.local/ui-check`에 저장되며 실제 사용자의 Chrome 프로필이나 운영 계정은 사용하지 않는다.

## 운영 서비스 경계

| 서비스 | 실행 | 필수 환경/설정 |
| --- | --- | --- |
| web | `apps/site/Dockerfile` | `RAILWAY_DOCKERFILE_PATH=apps/site/Dockerfile`, `/health` |
| console | 루트 Dockerfile | `NULLGE_SERVICE=console`, `PORT=8080`, `CONSOLE_ORIGIN`, `API_INTERNAL_URL` |
| api | 루트 Dockerfile | `NULLGE_SERVICE=api`, `PORT=8080`, `API_HOST=::`, `DATABASE_URL`, `CONSOLE_ORIGIN`, `CONSOLE_DEV_LOGIN=0` |
| worker | 루트 Dockerfile | `NULLGE_SERVICE=worker`, `DATABASE_URL` |

공통 `NODE_ENV=production`. API의 DB 참조는 `${{Postgres.DATABASE_URL}}`, Console의 API 참조는 `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`다. DB URL은 Console/공개 사이트에 넣지 않는다.

API 배포 전 명령은 `node scripts/migrate.mjs`다. 이 명령은 마이그레이션 후 초기 제품을 idempotent하게 삽입한다. `synchronize`는 꺼져 있다. 마이그레이션 실패 시 배포를 진행하지 않는다. DB 스키마 변경에는 이전 버전과 호환되는 확장 우선 방식을 사용한다.

API healthcheck는 `/health`, Console은 내부 API 연결을 확인하는 `/api/auth/options`다. API/Worker에는 공개 HTTP 도메인이 없다. Postgres의 공개 접속 URL도 현재 설정되어 있지 않다.

```sh
railway link --project 3c584db8-6a84-4244-851d-0a4911e42674
railway up --service web --detach
# 앞 서비스의 SUCCESS와 HTTP 응답을 확인한 후 다음 배포
railway up --service api --detach
railway up --service console --detach
railway up --service worker --detach
```

현재 GitHub 자동 배포는 연결하지 않았다. 도메인 전환 후 검증한 커밋을 기준으로 기존 `ooeunoo/nullge` 저장소를 각 서비스에 연결한다. 웹은 정적 파일 변경만, Console/API/Worker는 관련 workspace 변경만 감지하도록 설정한다. 민감한 환경변수 값을 로그나 문서에 출력하지 않는다.

## 운영자 Google 로그인

2026-09-25 완료: Google Cloud 프로젝트 `nullge`, 앱 `Nullge Console`, 웹 클라이언트 `Nullge Console Production`을 생성했다. 사용자 승인 후 Google 사용자 데이터 정책 동의 및 전용 키 생성을 진행했다. 키는 브라우저에서 Railway `api` 서비스 변수로 전달했으며 문서/저장소/로컬 파일에 기록하지 않았다. API 재배포 `7bd2937c-750c-48c2-b709-a94cded8fc53` SUCCESS와 실제 운영자 로그인을 확인했다.

Google 앱은 외부/테스트 모드이며 운영자 계정 1개만 테스트 사용자로 등록했다(실제 주소는 Railway `OWNER_EMAIL` 변수에만 둔다). 서버 `OWNER_EMAIL`도 동일하며 개발용 로그인은 비활성이다. 동의 화면은 기본 프로필(이름/프로필 사진)·이메일만 요청한다. 서버는 Google 식별자·이메일·이름만 저장하고 사진이나 Google 액세스 토큰은 저장하지 않는다.

설정 재구성/추가 검증 시:

1. 생성된 Google Cloud 프로젝트 `nullge`에서 전용 OAuth Web application을 생성한다. 승인된 운영자 이메일만 테스트 사용자/허용 목록에 넣는다. 기본 로그인 범위는 `openid`, `email`, `profile`만 사용한다.
2. Origin은 `https://console.nullge.com`, 콜백은 정확히 `https://console.nullge.com/api/auth/google/callback`으로 등록한다.
3. API 서비스에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`을 Railway의 비밀 변수로 설정한다. 클라이언트 secret은 문서·콘솔 출력·GitHub에 저장하지 않는다.
4. API와 Console의 `CONSOLE_ORIGIN` 일치 및 `CONSOLE_DEV_LOGIN=0`을 확인한다.
5. 허용된 계정 로그인·로그아웃, 허용되지 않은 계정 거절, 세션 만료, 콜백 재사용 거절을 검증한다.

Google 설정이 없어도 서버는 기동하지만 보호된 데이터 접근은 차단된다. 운영에서 로컬 로그인을 켜서 해결하지 않는다.

## GoDaddy DNS 전환

현재 DNS를 먼저 내보내거나 기록한다. MX/SPF/DKIM/DMARC/Zoho·Google 검증 레코드와 다른 제품 서브도메인은 유지한다. 네임서버를 변경하지 않는다.

2026-09-25 변경 전 확인(전체 24개 레코드 기록은 git 제외 `.local/dns-before-railway-2026-09-25.txt`):

- 루트 A: GitHub Pages의 `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `www` CNAME: `ooeunoo.github.io`.
- MX: Zoho. NS: `ns23.domaincontrol.com`, `ns24.domaincontrol.com`.
- Resend/SES용 send MX·SPF·DKIM, Zoho DKIM, DMARC, 기존 `_railway-verify.www` TXT도 존재하며 유지했다. send에 SPF TXT가 2개 존재하는 기존 상태를 발견했으나 이번 도메인 이전 범위에서는 수정하지 않았다.

Console 변경 완료: `console` CNAME → `fu280hho.up.railway.app`, `_railway-verify.console` TXT → 현재 Railway 검증 토큰을 추가했다. GoDaddy 목록은 26개이며 저장된 TTL은 1시간이다. 권한 네임서버에서 CNAME/TXT, 공개 resolver와 Railway에서 CNAME 전파를 확인했고 소유권 검증·인증서 발급도 완료됐다. 인증서 검증을 생략하지 않은 실제 HTTPS 요청에서 200을 확인했다.

순서:

1. Railway 웹 UI에서 `www.nullge.com`이 mellow 프로젝트 web 서비스에 이미 등록된 것으로 확인했다. 사용자 승인 후 해당 도메인 연결만 분리하고 nullge의 web:8080에 등록한다. 다른 mellow 도메인/서비스/데이터는 변경하지 않는다. 성공 전 DNS를 변경하지 않는다.
2. Railway가 **실제로 반환한** CNAME과 검증 TXT를 GoDaddy에 설정한다. 임시 URL이나 임의 IP를 목표값으로 추정하지 않는다.
3. Console CNAME·TXT 추가는 완료했다. 토큰은 변경될 수 있으므로 `railway domain status console.nullge.com --service console --json`으로 현재 요구값과 검증/인증서 상태를 확인한다.
4. GoDaddy는 Railway 루트 CNAME flattening을 지원하지 않는다. 루트 `nullge.com`을 `https://www.nullge.com`으로 HTTPS 영구 전달(301, 마스킹 없음)하도록 설정한다. www CNAME을 `@`로 바꾸지 않는다. 경로/쿼리 전달도 확인한다.
5. www/console의 DNS 전파, Railway 소유권 검증·인증서, HTTPS 응답, 루트 전달, 사이트 CSS/이미지를 확인한다.
6. 외부 네트워크에서도 정상 확인한 후 GitHub Pages 자동 배포를 중지한다. 그 전에는 기존 Pages 사이트와 워크플로를 보존한다.

문제가 생기면 기록한 www CNAME과 루트 A/전달 설정으로 되돌리고 기존 Pages를 사용한다. 복구 과정에서도 메일 레코드는 변경하지 않는다.

참고: [Railway 도메인 설정](https://docs.railway.com/networking/domains/working-with-domains), [GoDaddy HTTPS 도메인 전달](https://www.godaddy.com/help/forward-my-godaddy-domain-12123).

## 백업·복구

현재 자동 백업은 **비활성**이다. 볼륨 인스턴스 `9dad18ed-1fae-4932-afb4-47cc7875c578`에 DAILY/WEEKLY 스케줄 설정과 수동 백업 생성을 요청했지만 모두 `Not Authorized`가 반환됐다. CLI 읽기 조회에서 백업과 스케줄 모두 빈 배열임을 확인했다.

Railway Postgres → Backups에서 일간+주간 스케줄을 설정하고 스케줄 목록과 첫 완료 백업을 확인한다. 공식 기본 보존은 일간 6일·주간 27일이며 [Railway 백업 문서](https://docs.railway.com/volumes/backups)를 따른다. 설정되기 전 백업이 있다고 가정하고 중요한 데이터를 이관하지 않는다.

스키마 변경/기존 데이터 이관 전 수동 백업을 만들고 상태를 확인한다. 복원은 운영 중 자동으로 실행하지 않는다. 대상·복원 시각·예상 손실 범위를 확인하고 API/Worker를 중지한 뒤 Railway의 복원 절차와 검증을 거친다. 이전 볼륨은 검증 완료 전 제거하지 않는다. 첫 운영 전에 복구 연습을 수행해야 한다.
