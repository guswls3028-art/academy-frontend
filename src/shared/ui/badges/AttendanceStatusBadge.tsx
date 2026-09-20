// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
// 한글자(short) = 두글자(label) 첫글자/약자로 통일, 역할별 순서·색상

import { ATTENDANCE_META, type AttendanceStatus } from "./attendanceStatus";
import Badge from "../ds/components/Badge";

export type { AttendanceStatus } from "./attendanceStatus";

/** 사이즈 SSOT: 1ch(한글자) | 2ch(두글자) — styles/design-system/ds/status.css */
export default function AttendanceStatusBadge({
  status,
  variant = "2ch",
}: {
  status: AttendanceStatus;
  /** 1ch: 한글자(매트릭스 셀 등), 2ch: 두글자(출결 테이블·라벨) */
  variant?: "1ch" | "2ch";
}) {
  const meta = ATTENDANCE_META[status];
  if (!meta) return null;

  const text = variant === "1ch" ? meta.short : meta.label;

  return (
    <Badge
      variant="solid"
      tone={meta.tone}
      oneChar={variant === "1ch"}
      title={meta.label}
    >
      {text}
    </Badge>
  );
}
