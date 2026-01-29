// PATH: src/shared/ui/attendance/AttendanceBadge.tsx

import {
  ATTENDANCE_COLORS,
  ATTENDANCE_LABELS,
  AttendanceStatus,
} from "./attendanceTokens";
import { AttendanceIcon } from "./AttendanceIcon";

export default function AttendanceBadge({
  status,
}: {
  status: AttendanceStatus;
}) {
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        ATTENDANCE_COLORS[status],
      ].join(" ")}
    >
      <AttendanceIcon status={status} />
      {ATTENDANCE_LABELS[status]}
    </div>
  );
}
