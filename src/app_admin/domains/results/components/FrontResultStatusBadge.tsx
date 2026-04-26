/**
 * PATH: src/app_admin/domains/results/components/FrontResultStatusBadge.tsx
 *
 * FrontResultStatus 전용 Badge — DS Badge SSOT(variant=solid) 사용.
 * AdminExamResultsTable / AdminStudentResultDrawer Header에서 사용.
 */

import { Badge, type BadgeTone } from "@/shared/ui/ds";
import type { FrontResultStatus } from "../types/frontResultStatus";
import { FRONT_RESULT_STATUS_LABEL, FRONT_RESULT_STATUS_TONE } from "../containers/frontResultStatusMaps";

export default function FrontResultStatusBadge({
  status,
}: {
  status: FrontResultStatus;
}) {
  const tone = FRONT_RESULT_STATUS_TONE[status] as BadgeTone;
  return (
    <Badge variant="solid" tone={tone}>
      {FRONT_RESULT_STATUS_LABEL[status]}
    </Badge>
  );
}
