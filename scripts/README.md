# scripts

| 스크립트 | 용도 | 상태 |
|---|---|---|
| `harness-config-check.py` | `harness.config.json`을 하네스 스키마로 검증 (`make doctor`) | 사용 중 |
| `marketing/` | mellow 포스터·영상 마무리, SNS 프로필 이미지 렌더링. 생성된 PNG/WAV는 첫 실행 때 다시 만들어지며 Git 제외 | 사용 중 |

Nullge Console용 스크립트(dev·local-db·migrate·start·check-*·import-*)는 2026-11-11 Console 삭제와 함께 지웠다. 임시 산출물은 OS 임시 폴더나 `.local/`에만 둔다.
