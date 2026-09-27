# 결정·미정 사항과 근거

작성: 2026-09-25. 소스 조사와 기획의 범위를 명시한다.

## 결정 기록

| 항목 | 상태 | 내용과 이유 |
| --- | --- | --- |
| 운영 주체 | 사용자 확인 | Nullge는 개인 사업자의 상위 브랜드이고 여러 제품을 만든다 |
| 저장소 | 사용자 지정 반영 | 기존 `~/projects/eun/nullge` 사용. 새 marketing-studio 저장소 생성 취소 |
| 이번 작업 | 사용자 승인 확대 | 기획 후 구현 진행 승인. 모든 작업 순차 진행, 열린 웹페이지 주소 전달 |
| 제품 어드민 분리 | 합의 방향 | 마케팅은 Nullge에서 공통 운영하고 제품 고유 운영은 각 제품에 남김 |
| 내부 운영 우선 | 기본안 | 운영자 1인·작업공간 1개로 시작. 외부 고객용 SaaS는 첫 범위에서 제외 |
| 파일럿 제품 | 기본안 | mellow + ClipIt, 이후 minimo + desk |
| 배포 | 사용자 지정 | 공개 웹과 전용 Postgres를 포함하여 Nullge Railway 프로젝트로 이전. DNS는 GoDaddy 유지 |
| 첫 자동화 수준 | 기본안 | AI 초안·보조 검사 + 사용자 검토·예약, 무인 발행은 후속 |
| 기술 | 기본안 | 기존 TypeScript·Next.js·NestJS·Postgres·BullMQ 경험 활용 |
| 제품 통합 방법 | 기본안 | 프로필·자료 수동 등록부터, 각 서비스 DB 직접 연결 없음 |

## 시점별로 정할 사항

모든 항목을 한꺼번에 결정할 필요는 없다. 지금 기획과 화면 검토를 막는 항목은 없다.

| 항목 | 제안 기본값 | 결정이 필요한 시점 |
| --- | --- | --- |
| 내부 도구 이름 | Nullge Console | UI의 최종 이름을 정할 때 |
| 주소 | `console.nullge.com` 후보 | 인증·SNS 콜백과 배포 설정 전 |
| 운영자 인증 | Google 로그인 + 허용 운영자 | M1 인증 구현과 외부 앱 설정 전 |
| 호스팅·저장소 | Railway와 전용 Postgres 확정, Redis·미디어 버킷은 후속 | 큐·미디어 구현 전 |
| 첫 채널 | 현재 기록상 연결 경험이 있는 X | 실제 파일럿 계정 점검 시 |
| ClipIt 계정 | 기존 제품 계정 조사 후 연결 | ClipIt 실발행 전 |
| 생성 예산·한도 | 제품별 건수/동시 실행 제한, 비용 추정 표시 | 실제 유료 생성 활성화 전 |
| 프로필 최종 내용 | 저장소 기반 초안을 운영자가 검토 | 각 제품의 첫 AI 기획 전 |
| 계정 공유 | 첫 버전은 계정당 한 제품 | Nullge 공용 계정으로 여러 제품을 발행할 필요가 생길 때 |
| SaaS 확장 | 내부 운영에서 필요성을 판단 | 외부 고객·팀·결제 요구가 생길 때 |

Railway 로그인·프로젝트·배포 상태는 실제 계정에서 확인했다. SNS 계정·생성 공급자 잔액과 가격은 확인하지 않았다. 과거 크레딧·가격을 예산표에 재사용하지 않는다.

## 저장소 조사 기준

| 저장소 | 조사 당시 HEAD | 확인한 주요 자료 |
| --- | --- | --- |
| nullge | `fe2bdc6df949f5a0f2400caf1bcc5698e00236b5` | `index.html`, `.github/workflows/pages.yml`, `.gitignore` |
| mellow | `f3fe17634ce1f4aee655fd306f0fc73060750bda` | 마케팅 Web/API/Worker, 타입·엔티티·정책·보안, 마케팅 작업 기록 |
| clipit | `406f0eabb3f21e94524d714538343eaec62fefb3` | `README.md`, Web 패키지, Remotion 홍보 영상 README |
| minimo (이전 조사 대상 오류) | `a2143cdec6324bc8810aa851c8d45d4098abfceb` | 미니홈피 저장소는 사용자 정정으로 제외. 실제 대상은 `desktop_pet`, [최신 분석](10-product-setup.md) 참고 |
| minimo (`desktop_pet`) | `1bd2aae946be791f09394bf2779357af9e8cf9ac` | README, 브랜드 스펙, 실제 앱 아이콘, CLI 제공자 설정, 사람이 확인해야 할 검증 목록. 기존 작업 트리 수정은 보존 |
| desk | `6bbea86aa7c4303e816d86267dc1c3ca167d5cd1` | 루트·서버 패키지, copy guide, 이전 기획·파이프라인 설명 |

HEAD는 조사 기준 식별자다. 로컬 작업 트리에 별도 변경이 있을 수 있으며, 문서와 코드의 존재는 운영 배포/출시 증거와 다르다. 조사 당시 mellow의 다른 작업 변경을 확인했고 수정하지 않았다.

로컬 원본 자료는 `~/projects/eun/<저장소>/` 아래에 있다. 새 문서에서 비밀 파일·운영 덤프·인증 값은 읽거나 복사하지 않았다.

## mellow 소스에서 확인한 분리 필요 지점

- `packages/core/src/marketing/marketing-store.ts`: `settings.id = 1`로 전역 설정 조회.
- `packages/core/src/entities/marketing-settings.entity.ts`: 한 설정 행에 채널 계정·토큰 묶음·캠페인 정보가 있음.
- `packages/core/src/entities/marketing-post.entity.ts`: 제품 소속이 없고 편집·생성·발행 상태가 한 행에 묶임.
- `packages/core/src/marketing/marketing-policy.ts`: mellow 사실·대상 언어·색상·시각 방향이 코드에 고정됨.
- `apps/worker/src/marketing/marketing.service.ts`: 고정 전역 잠금과 전역 최근 게시물 조회, 기존 AI 사용량 서비스 의존.
- `apps/server/src/modules/marketing/marketing.controller.ts`: mellow 사용자/관리자 인증에 연결됨.
- `packages/core/src/marketing/marketing-security.ts`: 기존 암호화 AAD가 `mellow-marketing-v1`이며 단순 이름 변경 시 호환되지 않음.
- `docs/marketing/resume-2026-09-14.md`: 초안 8개·X 연결 완료로 이전 9월 12~13일 상태를 갱신.

위 사실을 근거로 제품별 데이터 경계·독립 인증·버전 기반 승인을 새 기반에 구현했다. 기존 데이터·토큰과 SNS 실행기는 아직 이관하지 않았다.

## 외부 기술 자료

2026-09-25 확인. 과거 코드의 계약과 현재 플랫폼 지원을 구분하기 위한 참고이며, 기획에서 모든 플랫폼 기능을 지원하겠다고 약속하지 않는다.

| 자료 | 확인 범위 | 계획에 반영한 내용 |
| --- | --- | --- |
| [X Create Posts](https://docs.x.com/x-api/posts/create-post) | 공식 문서 본문 조회 | 미디어 업로드와 게시물 생성/결과를 별도 단계로 다룸 |
| [X OAuth 2.0 PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) | 공식 문서 조회 | 새 콜백·사용자 계정 권한과 토큰 연결을 별도 검증 |
| [Meta 공식 Threads 컬렉션](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) | 검색 결과에서 앱 생성·사용자 인증 설명 확인, 직접 열기는 문서 셸만 노출 | 실구현 시 공식 전체 계약 재확인. 현행 권한·제한을 이번 문서에서 확정하지 않음 |
| [Instagram Login 콘텐츠 발행](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/) | 직접 조회 실패 | 현재 지원 조건은 미검증. 기존 코드·과거 운영 기록만으로 새 연결 완료를 주장하지 않음 |

## 남은 위험과 대응

| 위험 | 대응 |
| --- | --- |
| Meta 개발자 등록·권한이 계속 막힘 | 텍스트 초안·직접 게시·준비된 채널로 진행, 대기 채널은 명시 |
| 과거 프로필의 기능·가격이 현재와 다름 | 근거·확인일·프로필 버전과 재검토 적용 |
| 다른 제품 계정으로 잘못 발행 | 제품/계정 외래 키, 승인 스냅샷, 발행 직전 재검증 |
| 기존/새 Worker의 중복 실행 | 동결·최종 이관·기존 실행 중지 후 한쪽만 활성화 |
| 외부 요청 결과 유실 | 의도 기록, 결과 확인 필요, 불확실한 POST 자동 재시도 금지 |
| AI 미디어 비용·품질 | 첫 버전은 실제 자료 업로드 중심, 유료 생성은 한도·품질 확인 후 추가 |
| 공개 사이트와 내부 앱의 혼합 | 배포 산출물·인증·호스트 분리, 정적 사이트 allowlist 유지 |

관련 문서: [기획 시작점](README.md), [이관 계획](04-migration.md).
