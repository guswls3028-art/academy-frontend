# 학생앱 테넌트별 테마

- **기본 테마**: 상위 `tokens.css` (다크 톤, 학원플러스 등)
- **테넌트 오버라이드**: 이 폴더에 `{code}.css` 추가
  - 셀렉터: `[data-student-tenant="{code}"]`
  - `--stu-*` 변수만 재정의 (색상, 헤더/탭바 배경 등)
- **테넌트 추가 시**
  1. `tenants/{code}.css` 생성 후 `StudentLayout.tsx`에서 import
  2. 필요 시 `student/shared/tenant/studentTenantBranding.ts` 에 로고·타이틀 추가
