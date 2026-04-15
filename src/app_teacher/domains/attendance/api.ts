// PATH: src/app_teacher/domains/attendance/api.ts
// 출석 API — 기존 admin attendance API 100% 재사용
// 이 파일은 teacher 전용 타입/상수만 정의하고, 실제 API 호출은 기존 코드를 import
export {
  fetchAttendance,
  updateAttendance,
  bulkSetPresent,
} from "@admin/domains/lectures/api/attendance";
export type { AttendanceListResponse } from "@admin/domains/lectures/api/attendance";

/** 출석 상태 표시 설정 — 모바일 UI 전용 */
export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ONLINE"
  | "SUPPLEMENT"
  | "EARLY_LEAVE"
  | "ABSENT";

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PRESENT: { label: "출석", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  LATE: { label: "지각", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  ONLINE: { label: "온라인", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  SUPPLEMENT: {
    label: "보강",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
  },
  EARLY_LEAVE: {
    label: "조퇴",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
  },
  ABSENT: { label: "결석", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  RUNAWAY: { label: "이탈", color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  MATERIAL: { label: "교재", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  INACTIVE: {
    label: "비활성",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
  },
  SECESSION: {
    label: "탈퇴",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
  },
};

/** 스와이프/바텀시트에서 노출할 빠른 선택 상태 */
export const QUICK_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "ONLINE",
  "EARLY_LEAVE",
  "SUPPLEMENT",
];
