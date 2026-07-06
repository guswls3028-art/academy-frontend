# frontend/docs — 프론트엔드 문서

## 문서 목록

| 문서 | 내용 |
|------|------|
| [USER-GUIDE-ADMIN.md](USER-GUIDE-ADMIN.md) | 관리자 앱 사용 가이드 |
| [USER-GUIDE-STUDENT.md](USER-GUIDE-STUDENT.md) | 학생 앱 사용 가이드 |
| [REAL-USE-REVIEW-MANUAL.md](REAL-USE-REVIEW-MANUAL.md) | 실제 운영 흐름과 UI/UX 상품성을 함께 점검하는 반복 검수 매뉴얼 |
| [REAL-USE-E2E-INVENTORY.md](REAL-USE-E2E-INVENTORY.md) | 기존 E2E 자산을 실사용 운영 리뷰 관점으로 분류한 인벤토리 |

## 관련 위치

| 용도 | 경로 |
|------|------|
| E2E 테스트 | `frontend/e2e/` |
| 스크립트 | `frontend/scripts/` |
| 배포 | `git push origin main` → Cloudflare Pages 자동 배포 |
| 백엔드 문서 | `backend/docs/README.md` |

## E2E 테스트 구조

상세 구조·실행 방법·환경변수: [`frontend/e2e/README.md`](../e2e/README.md)

## 스크립트 구조

```
scripts/
├── ensure-spa-mode.js             ← SPA 모드 보장 (빌드)
├── lint-id-safety.cjs             ← ID 안전성 린트
├── verify-student-routes.mjs      ← 학생 라우트 검증
├── agent-bridge.mjs               ← 에이전트 브릿지
├── assets/                        ← 이미지/아이콘 처리 도구
└── dev/                           ← 로컬 개발 유틸
```

## 정리 기준

- 일회성 E2E 스펙은 검증 완료 후 삭제 (git history 조회 가능)
- 제품/사용자/운영 문서는 이 폴더에 배치
- 코드 바로 옆에 필요한 모듈 README·refactor note는 `src/<app>/...`에 둘 수 있다. 단, 해당 모듈의 구조·API·검증 범위만 다루고 전역 규칙/운영 절차는 `frontend/docs/` 또는 repo 루트 문서로 올린다.
- 스크린샷은 `e2e/screenshots/`에 저장, 커밋하지 않음
