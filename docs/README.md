# frontend/docs — 프론트엔드 문서

## 문서 목록

| 문서 | 내용 |
|------|------|
| [ROUTING.md](ROUTING.md) | 공개 URL 네이밍, 권한 분리, 기존 경로 호환 규칙 |
| [USER-GUIDE-ADMIN.md](USER-GUIDE-ADMIN.md) | 관리자 앱 사용 가이드 |
| [USER-GUIDE-STUDENT.md](USER-GUIDE-STUDENT.md) | 학생 앱 사용 가이드 |
| [REAL-USE-REVIEW-MANUAL.md](REAL-USE-REVIEW-MANUAL.md) | 실제 운영 흐름과 UI/UX 상품성을 함께 점검하는 반복 검수 매뉴얼 |
| [REAL-USE-E2E-INVENTORY.md](REAL-USE-E2E-INVENTORY.md) | 기존 E2E 자산을 실사용 운영 리뷰 관점으로 분류한 인벤토리 |
| [DEV-INBOX-GUIDE.md](DEV-INBOX-GUIDE.md) | 학원 직원 문의 제출·답변 확인과 플랫폼 문의 처리 가이드 |
| [TENANT-BRANDING.md](TENANT-BRANDING.md) | 신규 테넌트 로그인·역할별 공용 헤더 브랜딩 계약과 검증표 |
| [PRODUCT-USAGE-ANALYTICS.md](PRODUCT-USAGE-ANALYTICS.md) | 역할별 화면·CTA·대표 업무 사용 신호와 실패 안전 계약 |
| [TEACHER-TOOLS.md](TEACHER-TOOLS.md) | 강사 도구함 확장 규칙과 AI 풀이·해설 Beta 상호작용 계약 |
| [FIRST-LOGIN-GUIDE.md](FIRST-LOGIN-GUIDE.md) | 신규 계정의 공통 1회 계정 안내 UX와 역할별 이동 경로 |
| [PRODUCT-UPDATES.md](PRODUCT-UPDATES.md) | 공개 업데이트 페이지의 콘텐츠 범위, CTA, 접근성·라우팅 계약 |

## 관련 위치

| 용도 | 경로 |
|------|------|
| E2E 테스트 | `frontend/e2e/` |
| 스크립트 | `frontend/scripts/` |
| 배포 | `origin/main` quality gate → 격리 preview → 운영 baseline·소유권 확인 → direct deploy → 운영 E2E |
| 백엔드 문서 | `backend/docs/README.md` |

## E2E 테스트 구조

상세 구조·실행 방법·환경변수: [`frontend/e2e/README.md`](../e2e/README.md)

### 테마와 공용 컨트롤 계약

관리자·교사 앱의 12개 테마는 색상만 바꾸며 버튼과 탭의 의미·상태·조작
방식은 동일하게 유지한다. 테마 선택 진입점은
`/workspace/settings/appearance`이고 선택값은 브라우저에 저장되어 재방문
시 복원된다.

- 주요 버튼은 테마 브랜드색과 대비 텍스트를 사용한다.
- 호버는 배경·테두리·그림자 중 하나 이상, 선택 상태는 브랜드 강조와 윤곽으로
  기본 상태와 구분한다.
- 키보드 포커스는 버튼과 탭 모두 외곽 링으로 표시하며, 비활성 상태는
  불투명도와 커서로 함께 표현한다.
- 내용이 없는 헤더 위젯은 카드 껍데기를 렌더링하지 않는다.
- 로그인은 브랜드별 구조적 배경을 유지하되 빈 공간에 단독으로 남는 점 입자는
  표시하지 않는다.

소유 구현은 `src/styles/design-system/colors/themes/index.css`,
`src/styles/design-system/patterns/button.css`,
`src/styles/design-system/ds/tabs.css`, `src/auth/themes/`에 있다. 새 테마도
기존 테마와 같은 상태·대비 검증을 통과해야 한다.

```powershell
pnpm build
pnpm exec playwright test --config playwright.theme.config.ts --project=chromium --reporter=list
```

## 스크립트 구조

```
scripts/
├── ensure-spa-mode.js             ← SPA 모드 보장 (빌드)
├── lint-id-safety.cjs             ← ID 안전성 린트
├── verify-student-routes.mjs      ← 학생 라우트 검증
├── assets/                        ← 이미지/아이콘 처리 도구
└── dev/                           ← 로컬 개발 유틸
```

## 정리 기준

- 일회성 E2E 스펙은 검증 완료 후 삭제 (git history 조회 가능)
- 제품/사용자/운영 문서는 이 폴더에 배치
- 코드 바로 옆에 필요한 모듈 README·refactor note는 `src/<app>/...`에 둘 수 있다. 단, 해당 모듈의 구조·API·검증 범위만 다루고 전역 규칙/운영 절차는 `frontend/docs/` 또는 repo 루트 문서로 올린다.
- 스크린샷은 `e2e/screenshots/`에 저장, 커밋하지 않음
