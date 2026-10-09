# 서비스별 마케팅 현황

Nullge 제품들의 마케팅 실행 기록을 서비스별로 모은다. 새 세션은 이 파일과 해당 서비스의 `README.md`부터 읽는다. Console 자체의 기획·운영 문서는 `../01`–`13`에 있다.

## 현황판 (2026-10-10)

| 서비스 | 단계 | 지금 진행 중 | 다음 확인일 |
|---|---|---|---|
| [mellow](mellow/README.md) | 메시지 시험 + 첫 유료 광고 | Meta 광고 3종 비교(KR, 10/10~10/15, 약 30,000원) | 10/12 중간 점검, 10/15 종료 |
| [ClipIt](clipit/README.md) | 계정 준비 | 없음 | — |
| [다락방 카메라](atticcamera/README.md) | 계정 준비 | 없음 | — |
| [Kept](kept/README.md) | 계정 준비 | 없음 | — |
| [두토리](dotori/README.md) | 계정 준비 | 없음 | — |

우선순위: mellow만 먼저 한다(운영자 결정, 2026-10-06). 다른 제품은 mellow에서 통한 방법을 옮겨 시작한다.

## 폴더 규칙

```
services/
├─ README.md            이 현황판
├─ common/              모든 서비스 공통
│  ├─ methodology-2026.md   마케팅 방법론 리서치와 90일 계획
│  ├─ social-accounts.md    제품별 SNS 계정(ko/en) 표와 소개글
│  ├─ paid-ads.md           유료 광고 공통 규칙(Meta 계정 구조, AI 인물 표시, 결제)
│  └─ creative-tools.md     영상·이미지 생성 도구 비교와 선택
└─ <서비스>/
   ├─ README.md         현재 상태 · 진행 중 · 다음 할 일 · 결정 · 금지 사항
   ├─ log.md            날짜별 진행 기록(최신이 위)
   ├─ content/          콘텐츠 기획·콘티 (YYYY-MM-DD-주제.md)
   ├─ ads/              유료 광고 캠페인 (YYYY-MM-DD-채널-주제.md)
   └─ creative/         광고·게시물 소재 목록과 만든 방법
```

- 일이 진행되면 그 서비스의 `README.md` 현재 상태와 `log.md`를 함께 고친다. 끝난 일은 `README.md`에서 지우고 `log.md`에 남긴다.
- 생성된 이미지·영상 파일은 저장소에 넣지 않는다. `.local/marketing/`에 두고 문서에는 경로만 적는다.
- 공개 저장소다. 비밀번호·토큰·카드·납세자 번호·운영자 개인 이메일과 이름은 적지 않는다.
