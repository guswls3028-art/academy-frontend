# 학생앱 테넌트별 테마

- **기본 테마**: 상위 `tokens.css` (다크 톤, 학원플러스 등)
- **테넌트 오버라이드**: 이 폴더에 `{code}.css` 추가 후 **`index.css`에만** `@import "{code}.css";` 추가
  - 셀렉터: `[data-student-tenant="{code}"]`
  - `--stu-*` 변수 재정의 (색상, 헤더/탭바, `--stu-gradient`, `--stu-focus` 등)
  - 테넌트 전용 클래스 오버라이드 가능 (예: `.stu-tabbar__link`, `.stu-btn--primary`)
- **테넌트 추가 시**
  1. `tenants/{code}.css` 생성
  2. `tenants/index.css`에 `@import "{code}.css";` 한 줄 추가
  3. `student/shared/tenant/studentTenantBranding.ts`에 로고·타이틀 추가
- **tchul(2번)**: auth 로그인 페이지 SSOT 색상·그라데이션 적용 (`@/features/auth/themes/tchul.css` 참고)
