# 다섯 제품 기본 설정 · 2026-09-25

최초 설정에서는 사용자 지정 저장소를 읽기 전용으로 분석했다. 이후 사용자 승인을 받아 minimo의 원본 프로젝트 로고와 콘솔 자산을 함께 개정했다. 인증·결제 설정, SNS 계정은 변경하지 않았다. 프로필은 출시 보증이나 고객 조사 결과가 아닌 **저장소 기반 초기 초안**이며 수동 확인 전까지 미검토 상태다.

| 제품 | 정체성 | 주요 근거 | 사용한 로고 원본 |
| --- | --- | --- | --- |
| ClipIt | 긴 영상 → AI 하이라이트·세로 클립 편집 | `README.md`, 웹 한국어 문구·메타데이터 | `clipit/apps/web/public/brand/app-icon.svg` |
| minimo | 화면 위 AI 데스크톱 펫·CLI 대화·허용 기반 화면 보기 | `desktop_pet/README.md`, 브랜드 스펙, `docs/verification.md`, AI 제공자 설정 | `desktop_pet/assets/brand/mark.svg` → `console-mark.svg` |
| mellow | AI 캐릭터 음성 통화·회화 학습·리포트·복습 | `README.md`, `assets/brand/README.md` | `mellow/assets/brand/app-icon.svg` |
| Movy | 내 사진으로 챌린지 영상 제작·저장·공유 | `README.md`, `docs/design/brand.md`, 현재 `app.json` | `movy/apps/mobile/assets/brandmark.png` |
| desk | 뉴스 오디오 브리핑·이슈 순위·팟캐스트 대본 | 모바일 HomeScreen·LiveScreen·TranscriptScreen, 서버 podcast, `docs/copy-guide.md` | `desk/apps/mobile/assets/icon.png` |

경로는 모두 `~/projects/eun/` 기준. 콘솔의 사이드바·제품 카드·제품 헤더·문구 미리보기에서 같은 로고를 사용한다. 제품·브랜드 화면에는 원본 로고, 제품 분류, 저장소 위치, 로고 출처도 표시한다. 로고 파일은 원본 그대로 복사했고 투명 부분은 흰 바탕으로 표시한다. 알 수 없는 제품이나 이미지 로딩 실패는 기존 이니셜로 대체한다.

## 분석 시 구분한 것

- 모든 제품에 설명, 고객 가설, 확인한 기능·근거·날짜, 제안 말투, 피할 표현을 입력했다.
- 사용자가 minimo 경로를 `~/projects/eun/desktop_pet`로 정정했다. 이름·slug는 `minimo` 그대로 유지하며 미니홈피 프로젝트는 이번 등록 대상에서 제외한다. 초기에는 주황 픽셀 M을 썼고, 2026-09-25 사용자 승인 후 주황 companion 심볼로 교체했다. 기존 CLI 계정이 필요하고 입력·허용한 캡처가 AI 제공자에게 전달될 수 있다는 점, Windows·음성·Gemini 실사용 검증의 한계를 프로필에 기록했다.
- Movy의 예전 브랜드 문서보다 현재 앱에 연결된 라임 로고를 우선했다. 현재 모바일 UI의 액센트는 `#D7FF66`. 사람·동물 모두 제품 방향이지만 동물 품질이나 모든 사진에서의 성공을 보장하지 않는다.
- Desk는 예전 파이프라인 설계보다 현재 모바일 화면·서버 코드를 우선했다. 카피 가이드의 타사 구독자·성과 수치는 가져오지 않았다.
- 가격, 스토어 출시 상태, 실제 SNS 계정, 최신 운영 가용성은 확인하지 않았으므로 확정값이나 홍보 주장으로 넣지 않았다.
- ClipIt·mellow의 기존 소개 URL은 유지했다. minimo·Movy·desk는 공식 공개 URL을 임의로 만들지 않고 비워 두었다.

## 데이터 보존 방식

`ProductProfiles1790352000000` 마이그레이션은 원래 bootstrap의 모든 필드와 일치하고, revision 1·미검토·콘텐츠 없음인 기존 4개 프로필만 버전 2로 보강한다. 이전 스냅샷은 그대로 두고 변경 이력을 기록한다. 직접 수정한 값, 이미 확인한 프로필, 콘텐츠와 연결된 프로필, 다른 작업공간은 건너뛴다.

bootstrap은 신규 Movy를 포함한 5개 제품을 누락된 경우에만 등록한다. 반복 실행해도 기존 입력값을 덮어쓰지 않는다. `product-catalog-20260925.ts`는 마이그레이션 재현을 위한 고정 스냅샷이며 앞으로의 변경은 새 버전 또는 콘솔 편집으로 수행한다. DB 전체 백업을 대신하는 기능은 아니다.

첫 API 배포가 이미 적용된 뒤 minimo 경로 정정이 도착했으므로 `MinimoRepositoryCorrection1790352300000`으로 잘못된 자동 입력값만 후속 정정한다. 이전 버전은 감사 이력으로 보존하고, 신규 환경 bootstrap은 `minimo-desktop-pet.ts`의 올바른 값을 바로 사용한다. 직접 수정·검토했거나 콘텐츠가 연결된 프로필은 자동 정정하지 않는다.

## 검증

- 실제 격리된 PostgreSQL 테스트: 초기 5개 프로필, 입력 계약, 제품 경계·동시 수정·승인 보호, 원본 버전 보존, 가져오기 반복 안전성, 수정·검토·콘텐츠가 있는 데이터 보호, 로컬 로고 파일 검증. minimo 정정의 이름 유지·다른 제품 보존·중복 적용 안전성·사용자 수정 보호도 추가 검증한다.
- 로컬 데스크톱에서 5개 제품·로고 10곳 로딩, 제품·브랜드의 내용·출처 표시 확인. 초안이나 확인 완료 상태를 테스트용으로 만들지 않는다.
- 운영 배포·최종 화면 검증 결과는 [구현 상태](08-implementation-status.md)에 기록한다.

## 2026-10-02 — 제품 3개 추가 (다락방 카메라 · Kept · Dotori)

운영자 요청으로 `~/projects/eun/{atticcamera,kept,dotori}`를 분석해 기본 프로필과 로고를 추가했다. 기존 5개 제품과 같은 규칙이다: 저장소 문서에 근거한 초안이며 "프로필 확인 필요" 상태로 시작하고, bootstrap은 없는 제품만 넣고 기존 입력을 덮어쓰지 않는다.

| slug | 이름 | 한 줄 | 근거 문서 | 로고 원본 | 사이트 |
|---|---|---|---|---|---|
| `atticcamera` | 다락방 카메라 | 1970–2012 추억의 카메라 35대로 오늘을 찍는 카메라 앱 | README.md, docs/store-listing.md, docs/business-model.md | apps/mobile/assets/icon.png | https://atticcamera.nullge.com/ |
| `kept` | Kept | 광고·가입 없는 조용한 성경 읽기·기도 앱 | store/listing.md, docs/specs/kept.md | apps/mobile/assets/icon.png | https://kept.nullge.com/ |
| `dotori` | Dotori (한국어 두토리) | 오늘 할 일 3–5개, 못 한 일은 다정하게 넘기는 플래너 | store/ios/ko/metadata.json, docs/specs/{billing,ads,web-landing}.md | design/exports/app-icon.png | https://dotori.nullge.com/ (한국어 `/ko/`) |

- 프로필 원본은 `packages/database/src/product-catalog-20261002.ts`. 9월 25일 카탈로그는 마이그레이션 재현용이라 그대로 두고, `currentProductCatalog`가 두 목록을 합친다.
- 로고는 각 앱 아이콘을 240px PNG로 줄여 `apps/console/public/brands/`에 뒀다. 설정 화면의 "기본 정보 분석" 날짜는 제품별로 표시한다.
- 확인하지 못해 프로필 "주의"에 적어 둔 것: 다락방 카메라의 무료 범위(문서 두 개가 서로 다름)와 제조사 비제휴, Kept의 스토어 공개 여부와 한국어 성경 미제공, Dotori의 공개 출시 여부와 가격 변동 가능성. 게시 전 운영자가 브랜드 설정에서 확인한다.
- 세 사이트 모두 2026-10-02 HTTPS 200 확인.
- 검증: 테스트 71건(제품 8개·로고 검사 포함), 로컬 Console에서 전체 보기 카드 8개·로고 로딩·Kept 설정 화면 확인.

### 공개 랜딩 (같은 날)

`www.nullge.com`의 "우리가 만드는 서비스"에 다락방카메라·Kept·두토리 카드를 추가했다(기존 Mellow·ClipIt과 같은 형식, 각 제품 사이트로 연결). 문구는 각 제품의 자체 사이트·스토어 문구에서 가져왔고 가격·출시 상태는 적지 않았다. 메타 설명과 고객지원 링크(다락방카메라 메일, 두토리 지원 페이지)도 갱신했다. minimo·Movy·desk는 운영자 지시로 랜딩에 넣지 않았다(공개 사이트도 없음).

### minimo · Movy · desk 제거 (같은 날)

운영자 지시로 세 제품을 Console에서 뺐다. 랜딩에는 처음부터 없었다.

- `ProductsRetired1790726400000` 마이그레이션이 제품과 프로필 이력·이벤트·채널 연결·미게시 생성 기록을 지운다. 콘텐츠(posts)가 있는 제품은 지우지 않고 남기며, 결과를 배포 로그 한 줄로 남긴다.
- `currentProductCatalog`에서 세 제품을 걸러 bootstrap이 다시 넣지 않는다. 9월 25일 카탈로그와 minimo 정정 마이그레이션은 재현용으로 그대로 둔다.
- 브랜드 등록·로고 파일·로그인 화면 문구에서 제거. 현재 제품: ClipIt, mellow, 다락방 카메라, Kept, Dotori.
- 되돌리려면 카탈로그에 다시 추가한다(삭제된 프로필 이력은 복구되지 않는다).
