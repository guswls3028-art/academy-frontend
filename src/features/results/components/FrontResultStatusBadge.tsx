/**
 * PATH: src/features/results/components/FrontResultStatusBadge.tsx
 *
 * ✅ FrontResultStatus 전용 Badge
 *
 * 사용 위치:
 * - AdminExamResultsTable (상태 컬럼)
 * - AdminStudentResultDrawer Header
 *
 * ❌ SubmissionStatusBadge 대체 아님
 * - SubmissionStatusBadge는 "제출 상태" 전용
 */

import type { FrontResultStatus } from "../types/frontResultStatus";
import { FRONT_RESULT_STATUS_LABEL, FRONT_RESULT_STATUS_TONE } from "../containers/frontResultStatusMaps";

export default function FrontResultStatusBadge({
  status,
}: {
  status: FrontResultStatus;
}) {
  const tone = FRONT_RESULT_STATUS_TONE[status];

  return (
    <span className="ds-status-badge" data-tone={tone}>
      {FRONT_RESULT_STATUS_LABEL[status]}
    </span>
  );
}
