// PATH: src/shared/ui/attendance/attendanceTokens.ts

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EARLY_LEAVE"
  | "EXCUSED"
  | "SICK"
  | "ONLINE"
  | "UNKNOWN";

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-amber-100 text-amber-700",
  EARLY_LEAVE: "bg-orange-100 text-orange-700",
  EXCUSED: "bg-sky-100 text-sky-700",
  SICK: "bg-pink-100 text-pink-700",
  ONLINE: "bg-indigo-100 text-indigo-700",
  UNKNOWN: "bg-gray-100 text-gray-500",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "출석",
  ABSENT: "결석",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
  EXCUSED: "공결",
  SICK: "병결",
  ONLINE: "온라인",
  UNKNOWN: "미정",
};
