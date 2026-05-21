export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ONLINE"
  | "SUPPLEMENT"
  | "EARLY_LEAVE"
  | "ABSENT"
  | "RUNAWAY"
  | "MATERIAL"
  | "INACTIVE"
  | "SECESSION";

/** 역할별 순서: 출석인정 -> 경고 -> 부정 -> 중립 */
export const ORDERED_ATTENDANCE_STATUS: AttendanceStatus[] = [
  "PRESENT",
  "ONLINE",
  "SUPPLEMENT",
  "LATE",
  "EARLY_LEAVE",
  "ABSENT",
  "RUNAWAY",
  "MATERIAL",
  "INACTIVE",
  "SECESSION",
];

/** 출결 상태별 두글자 라벨·한글자(앞글자)·톤 — 색상은 ds-status-badge[data-tone] SSOT */
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; tone: string }
> = {
  PRESENT: { label: "현장", short: "현", tone: "success" },
  ONLINE: { label: "영상", short: "영", tone: "primary" },
  SUPPLEMENT: { label: "보강", short: "보", tone: "teal" },
  LATE: { label: "지각", short: "지", tone: "warning" },
  EARLY_LEAVE: { label: "조퇴", short: "조", tone: "warning" },
  ABSENT: { label: "결석", short: "결", tone: "danger" },
  RUNAWAY: { label: "출튀", short: "출", tone: "danger" },
  MATERIAL: { label: "자료", short: "자", tone: "neutral" },
  INACTIVE: { label: "부재", short: "부", tone: "neutral" },
  SECESSION: { label: "퇴원", short: "퇴", tone: "neutral" },
};

/** 한글자 출결 뱃지용 — 매트릭스 테이블 셀 등 */
export function getAttendanceShortLabel(status: string | null | undefined): string {
  if (!status) return "－";
  const meta = ATTENDANCE_STATUS_META[status as AttendanceStatus];
  return meta?.short ?? "－";
}

/** data-tone 값 반환 — ds-status-badge 시스템과 통합 */
export function getAttendanceTone(status: string | null | undefined): string | null {
  if (!status) return null;
  const meta = ATTENDANCE_STATUS_META[status as AttendanceStatus];
  return meta?.tone ?? null;
}
