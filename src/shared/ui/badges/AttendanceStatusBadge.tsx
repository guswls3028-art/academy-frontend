// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
// 한글자(short) = 두글자(label) 첫글자/약자로 통일, 역할별 순서·색상

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

/** 역할별 순서: 출석인정 → 경고 → 부정 → 중립 */
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

/** 출결 상태별 두글자 라벨·한글자(앞글자)·톤 — 한글자는 두글자 앞글자만 사용
 *  색상은 ds-status-badge[data-tone] SSOT (status.css) 를 따름 */
const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; tone: string }
> = {
  PRESENT:     { label: "현장", short: "현", tone: "success" },
  ONLINE:      { label: "영상", short: "영", tone: "primary" },
  SUPPLEMENT:  { label: "보강", short: "보", tone: "teal" },
  LATE:        { label: "지각", short: "지", tone: "warning" },
  EARLY_LEAVE: { label: "조퇴", short: "조", tone: "warning" },
  ABSENT:      { label: "결석", short: "결", tone: "danger" },
  RUNAWAY:     { label: "출튀", short: "출", tone: "danger" },
  MATERIAL:    { label: "자료", short: "자", tone: "neutral" },
  INACTIVE:    { label: "부재", short: "부", tone: "neutral" },
  SECESSION:   { label: "퇴원", short: "퇴", tone: "neutral" },
};

/** 한글자 출결 뱃지용 — 매트릭스 테이블 셀 등 */
export function getAttendanceShortLabel(status: string | null | undefined): string {
  if (!status) return "－";
  const meta = STATUS_META[status as AttendanceStatus];
  return meta?.short ?? "－";
}

/** data-tone 값 반환 — ds-status-badge 시스템과 통합 */
export function getAttendanceTone(status: string | null | undefined): string | null {
  if (!status) return null;
  const meta = STATUS_META[status as AttendanceStatus];
  return meta?.tone ?? null;
}

/** 사이즈 SSOT: 1ch(한글자) | 2ch(두글자) — styles/design-system/ds/status.css */
export default function AttendanceStatusBadge({
  status,
  variant = "2ch",
  selected = false,
}: {
  status: AttendanceStatus;
  /** 1ch: 한글자(매트릭스 셀 등), 2ch: 두글자(출결 테이블·라벨) */
  variant?: "1ch" | "2ch";
  /** 테이블 등에서 현재 선택된 출석형태로 강조 표시 */
  selected?: boolean;
}) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  const text = variant === "1ch" ? meta.short : meta.label;
  const sizeClass = variant === "1ch" ? "ds-status-badge ds-status-badge--1ch" : "ds-status-badge";
  const selectedClass = selected ? " attendance-status-badge--selected" : "";

  return (
    <span
      className={sizeClass + selectedClass}
      data-tone={meta.tone}
      title={meta.label}
    >
      {text}
    </span>
  );
}
