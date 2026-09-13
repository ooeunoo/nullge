# Nullge

Nullge(널지) 회사 소개 웹사이트. https://www.nullge.com/

HTML·CSS와 정적 이미지·폰트만 사용합니다. 빌드, Node.js, 서버, 환경변수가 필요하지 않습니다.

## 로컬 확인

```sh
python3 -m http.server 8180
```

http://localhost:8180/ 에 접속합니다.

## 수정 및 배포

- `index.html`: 회사 소개, 서비스, 연락처
- `styles.css`: 반응형 스타일
- `assets/`: 로고와 자체 호스팅 폰트
- GitHub Pages: `main`에 푸시하면 `.github/workflows/pages.yml`이 자동 배포합니다.
- 배포 파일은 HTML·CSS·이미지·폰트와 검색엔진 설정만 포함합니다.
- 커스텀 도메인: GitHub 저장소 Settings → Pages에서 `www.nullge.com`으로 설정합니다.
- GoDaddy DNS: `www` CNAME → `ooeunoo.github.io`
- `nullge.com`은 GoDaddy의 HTTPS 전달로 `https://www.nullge.com/`에 연결합니다.

배포용 비밀키나 메일 계정 설정을 이 공개 저장소에 추가하지 않습니다.

Montserrat 폰트의 라이선스는 `assets/Montserrat-OFL.txt`에 있습니다.
