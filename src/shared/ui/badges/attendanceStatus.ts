import type { BadgeTone } from "@/shared/ui/ds/components/Badge";

export type AttendanceStatus =
  | "UNSET"
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

/** 역할별 순서: 미입력 -> 출석인정 -> 경고 -> 부정 -> 중립 */
export const ORDERED_ATTENDANCE_STATUS: AttendanceStatus[] = [
  "UNSET",
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
export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; short: string; tone: BadgeTone }
> = {
  UNSET: { label: "미입력", short: "－", tone: "neutral" },
  PRESENT: { label: "현장", short: "현", tone: "success" },
  ONLINE: { label: "영상", short: "영", tone: "primary" },
  SUPPLEMENT: { label: "보강", short: "보", tone: "teal" },
  LATE: { label: "지각", short: "지", tone: "warning" },
  EARLY_LEAVE: { label: "조퇴", short: "조", tone: "warning" },
  ABSENT: { label: "결석", short: "결", tone: "danger" },
  RUNAWAY: { label: "출튀", short: "출", tone: "danger" },
  MATERIAL: { label: "자료", short: "자", tone: "neutral" },
  INACTIVE: { label: "부재", short: "부", tone: "complement" },
  SECESSION: { label: "퇴원", short: "퇴", tone: "danger" },
};

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--color-text-secondary)",
  success: "var(--color-success-solid)",
  primary: "var(--color-brand-primary)",
  teal: "var(--color-teal)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger-solid)",
  complement: "var(--color-brand-complement)",
};

/** 상태 선택과 요약도 뱃지의 같은 이름·의미 색상을 사용한다. */
export const ATTENDANCE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> =
  Object.fromEntries(ORDERED_ATTENDANCE_STATUS.map((status) => {
    const meta = ATTENDANCE_META[status];
    const color = TONE_COLOR[meta.tone];
    return [status, { label: meta.label, color, bg: `color-mix(in srgb, ${color} 12%, transparent)` }];
  }));

/** 화면 크기·역할과 관계없이 출결 상태 이름은 이 정의를 사용한다. */
export function getAttendanceLabel(status: string | null | undefined): string {
  if (!status) return ATTENDANCE_META.UNSET.label;
  return ATTENDANCE_META[status as AttendanceStatus]?.label ?? status;
}

/** 한글자 출결 뱃지용 — 매트릭스 테이블 셀 등 */
export function getAttendanceShortLabel(status: string | null | undefined): string {
  if (!status) return "－";
  const meta = ATTENDANCE_META[status as AttendanceStatus];
  return meta?.short ?? "－";
}

/** data-tone 값 반환 — ds-status-badge 시스템과 통합 */
export function getAttendanceTone(status: string | null | undefined): string | null {
  if (!status) return null;
  const meta = ATTENDANCE_META[status as AttendanceStatus];
  return meta?.tone ?? null;
}
