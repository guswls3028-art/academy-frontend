# 역할별 라우트·표시 권한

백엔드 데이터 권한의 정본은
`backend/docs/domain/role-data-action-policy.md`다. 프런트는 서버가 거부할 요청을
숨기거나 명확한 권한 상태로 닫고, 서버가 허용한 업무 식별 정보를 다시 가려 실제
업무를 막지 않는다.

## 화면 계약

- 학생은 학생 앱에서 본인 결과만, 보호자는 `X-Student-Id`로 확정된 연결 자녀
  결과만 표시한다. 목록 캐시나 URL의 다른 학생 데이터를 fallback으로 사용하지
  않는다.
- 강사·조교는 결과·출결·클리닉·과제·학생 연락처·알림톡 처리 이력의 일반 운영
  화면을 사용한다. 발송 이력에서는 실제 수신 전화와 공급사 접수 ID를 표시하며
  이름이나 번호를 프런트에서 다시 마스킹하지 않는다.
- `/workspace/staff/*`, 직원 급여 운영 메뉴와 모바일 PC 기능 허브의 급여 진입점은
  `tenantRole=owner/admin`과 서버 `is_payroll_manager=true`를 모두 요구한다.
  강사·조교의 오래된 `is_manager` 또는 잘못된 서버 boolean만으로 열지 않는다.
- 직원 생성·수정·상세·목록·Excel에는 효과가 없는 `is_manager` 권한 토글이나
  권한 열을 표시하지 않는다. 직원·급여 관리 여부는 계정 역할로만 설명한다.
- tenant 결제·조직 정책·소유자 설정은 각 route의 owner/admin guard를 유지한다.
  disabled control만 남기지 않고 권한 없는 메뉴와 직접 URL을 함께 차단한다.
- API `403`이나 권한 확인 실패를 빈 목록·0원으로 바꾸지 않는다.

## 검증

```powershell
pnpm typecheck
pnpm exec eslint src/app_admin/layout/useAvailableAdminNavigation.ts src/app_admin/domains/staff/StaffLayout.tsx src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx src/app_teacher/domains/comms/pages/MessageLogPage.tsx src/app_teacher/domains/comms/api/index.ts e2e/teacher/full-workspace-parity.mock.spec.ts
$env:E2E_BASE_URL='http://127.0.0.1:4185'
pnpm exec playwright test e2e/teacher/full-workspace-parity.mock.spec.ts --project=chromium --retries=0 --reporter=list -g "오래된 급여 관리자|발송 이력은"
```
