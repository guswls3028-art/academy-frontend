// PATH: src/features/sessions/routes/SessionAssignmentsRoute.tsx

import SessionAssessmentWorkspace from "../components/SessionAssessmentWorkspace";

/**
 * SessionAssignmentsRoute
 * - "과제" 탭 엔트리
 * - 실제 화면/UX는 SessionAssessmentWorkspace가 담당
 * - 도메인 스펙/계약 변경 금지 (여긴 라우팅 껍데기)
 */
export default function SessionAssignmentsRoute() {
  return <SessionAssessmentWorkspace mode="homework" />;
}
