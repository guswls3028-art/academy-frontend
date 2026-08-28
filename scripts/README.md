# frontend/scripts 시작점

프론트 스크립트를 실행하거나 수정할 때는 먼저 `frontend/docs/README.md`를 읽는다.

## 원칙

- 이 폴더는 프론트 로컬 보조 스크립트 모음이다.
- 백엔드 배포 SSOT(`backend/docs/ssot/*`)를 직접 기준으로 삼지 않는다.
- 운영 배포/인프라 기준은 백엔드 repo의 `scripts/v1`와 `backend/docs/ssot`를 따른다.
- 프론트 품질 게이트의 실행 진실은 `package.json` scripts와 `.github/workflows/quality-gate.yml`다.
- Playwright suite 목록은 `../e2e/suites.mjs`, 작성·로컬 실행 규칙은
  `../e2e/README.md`가 소유한다.
- 날짜성 진단, screenshot dump, 일회성 rewrite 스크립트는 작업 종료 후 제거하고
  Git 이력이나 Actions artifact에서 조회한다.
