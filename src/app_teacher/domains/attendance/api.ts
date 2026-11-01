// PATH: src/app_teacher/domains/attendance/api.ts
// 출석 API — shared attendance contract facade
import { ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";
export { ATTENDANCE_STATUS_CONFIG as STATUS_CONFIG } from "@/shared/ui/badges/attendanceStatus";

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

/** 좁은 화면에서도 PC의 모든 상태를 선택할 수 있다. */
export const QUICK_STATUSES = ORDERED_ATTENDANCE_STATUS;
