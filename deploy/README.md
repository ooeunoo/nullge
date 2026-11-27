# 서버 배포 (nullge)

서버 규칙은 private 저장소 `ooeunoo/nullge-infra`를 따른다(로컬: `~/projects/eun/nullge-infra`).

| 항목 | 값 |
|---|---|
| LXC | `svc-nullge` (VMID 200, 10.10.0.100) |
| 접속 | `ssh nullge-nullge` (계정 `deploy`, 키 `~/.ssh/nullge-nullge`, `ProxyJump nullge-host-1`) |
| 서버 경로 | `/srv/nullge/compose.yml`, `/srv/nullge/.env` |
| 역할·포트 | `web` 3000 |
| 이미지 | `ghcr.io/ooeunoo/nullge-web:<git sha 7자리>` |
| 도메인 | `www.nullge.com` (루트 `nullge.com`은 앱이 `www`로 308 전달) |
| DB·Redis | 없음 |

## 배포

```bash
make deploy-server
```

현재 커밋으로 linux/amd64 이미지를 빌드한다. 이미지를 서버로 전송하고 `docker compose up -d`를 실행한 뒤 `/health`를 확인한다. GHCR 자동 빌드는 추후 도입한다.

## 되돌리기

```bash
ssh nullge-nullge 'cd /srv/nullge && docker image ls ghcr.io/ooeunoo/nullge-web'
ssh nullge-nullge 'cd /srv/nullge && sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<이전 태그>/" .env && docker compose up -d'
```
