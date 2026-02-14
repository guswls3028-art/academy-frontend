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
import {
  FRONT_RESULT_STATUS_COLOR,
  FRONT_RESULT_STATUS_LABEL,
} from "../containers/frontResultStatusMaps";

/** 색상만 (사이즈는 ds-status-badge SSOT) */
const COLOR_CLASS: Record<string, string> = {
  gray: "!bg-neutral-800 !text-neutral-200",
  yellow: "!bg-yellow-950 !text-yellow-200",
  blue: "!bg-blue-950 !text-blue-200",
  green: "!bg-emerald-950 !text-emerald-200",
  red: "!bg-red-950 !text-red-200",
};

export default function FrontResultStatusBadge({
  status,
}: {
  status: FrontResultStatus;
}) {
  const key = FRONT_RESULT_STATUS_COLOR[status];
  const cls = COLOR_CLASS[key] ?? COLOR_CLASS.gray;

  return (
    <span className={`ds-status-badge ${cls}`}>
      {FRONT_RESULT_STATUS_LABEL[status]}
    </span>
  );
}
