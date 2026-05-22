// PATH: src/app_admin/domains/lectures/api/attendance.ts
export {
  bulkCreateAttendance,
  bulkSetPresent,
  deleteAttendance,
  downloadAttendanceExcel,
  fetchAttendance,
  fetchAttendanceEnrolledStudentIds,
  fetchAttendanceMatrix,
  updateAttendance,
  type AttendanceListItem,
  type AttendanceListResponse,
  type AttendanceMatrixCell,
  type AttendanceMatrixResponse,
  type AttendanceMatrixSession,
  type AttendanceMatrixStudent,
  type AttendanceRow,
} from "@/shared/api/contracts/attendance";
