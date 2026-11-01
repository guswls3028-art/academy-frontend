// PATH: src/app_teacher/domains/attendance/api.ts
// 출석 API — shared attendance contract facade
import { ATTENDANCE_META, ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";

export {
  fetchAttendance,
  fetchAttendanceRoster,
  updateAttendance,
  bulkSetPresent,
} from "@/shared/api/contracts/attendance";
export type {
  AttendanceListItem,
  AttendanceListResponse,
} from "@/shared/api/contracts/attendance";

/** PC와 모바일은 같은 상태명·순서·의미 색상을 사용한다. */
export type { AttendanceStatus };

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--color-text-secondary)",
  success: "var(--color-success-solid)",
  primary: "var(--color-brand-primary)",
  teal: "var(--color-teal)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger-solid)",
  complement: "var(--color-brand-complement)",
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = Object.fromEntries(ORDERED_ATTENDANCE_STATUS.map((status) => {
  const meta = ATTENDANCE_META[status];
  const color = TONE_COLOR[meta.tone];
  return [status, { label: meta.label, color, bg: `color-mix(in srgb, ${color} 12%, transparent)` }];
}));

/** 좁은 화면에서도 PC의 모든 상태를 선택할 수 있다. */
export const QUICK_STATUSES = ORDERED_ATTENDANCE_STATUS;
