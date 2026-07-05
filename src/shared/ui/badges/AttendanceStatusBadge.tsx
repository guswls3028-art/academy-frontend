// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
// 한글자(short) = 두글자(label) 첫글자/약자로 통일, 역할별 순서·색상

import { ATTENDANCE_STATUS_META, type AttendanceStatus } from "./attendanceStatus";
import Badge, { type BadgeTone } from "../ds/components/Badge";

export type { AttendanceStatus } from "./attendanceStatus";

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
  const meta = ATTENDANCE_STATUS_META[status];
  if (!meta) return null;

  const text = variant === "1ch" ? meta.short : meta.label;
  const selectedClass = selected ? "attendance-status-badge--selected" : undefined;

  return (
    <Badge
      variant="solid"
      tone={meta.tone as BadgeTone}
      oneChar={variant === "1ch"}
      className={selectedClass}
      title={meta.label}
    >
      {text}
    </Badge>
  );
}
