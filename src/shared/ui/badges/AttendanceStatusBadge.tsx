// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
// 한글자(short) = 두글자(label) 첫글자/약자로 통일, 역할별 순서·색상

import React from "react";

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

/** 출결 상태별 두글자 라벨·한글자(앞글자)·색상 — 한글자는 두글자 앞글자만 사용 */
const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; style: React.CSSProperties }
> = {
  PRESENT: { label: "현장", short: "현", style: { backgroundColor: "#22c55e", color: "#fff" } },
  ONLINE: { label: "영상", short: "영", style: { backgroundColor: "#3b82f6", color: "#fff" } },
  SUPPLEMENT: { label: "보강", short: "보", style: { backgroundColor: "#14b8a6", color: "#fff" } },
  LATE: { label: "지각", short: "지", style: { backgroundColor: "#f59e0b", color: "#fff" } },
  EARLY_LEAVE: { label: "조퇴", short: "조", style: { backgroundColor: "#eab308", color: "#1f2937" } },
  ABSENT: { label: "결석", short: "결", style: { backgroundColor: "#ef4444", color: "#fff" } },
  RUNAWAY: { label: "출튀", short: "출", style: { backgroundColor: "#dc2626", color: "#fff" } },
  MATERIAL: { label: "자료", short: "자", style: { backgroundColor: "#94a3b8", color: "#fff" } },
  INACTIVE: { label: "부재", short: "부", style: { backgroundColor: "#cbd5e1", color: "#475569" } },
  SECESSION: { label: "퇴원", short: "퇴", style: { backgroundColor: "#64748b", color: "#fff" } },
};

/** 한글자 출결 뱃지용 — 매트릭스 테이블 셀 등 */
export function getAttendanceShortLabel(status: string | null | undefined): string {
  if (!status) return "－";
  const meta = STATUS_META[status as AttendanceStatus];
  return meta?.short ?? "－";
}

export function getAttendanceStyle(status: string | null | undefined): React.CSSProperties | null {
  if (!status) return null;
  const meta = STATUS_META[status as AttendanceStatus];
  return meta?.style ?? null;
}

/** 사이즈 SSOT: 1ch(한글자) | 2ch(두글자) — shared/ui/ds/styles/status.css */
export default function AttendanceStatusBadge({
  status,
  variant = "2ch",
}: {
  status: AttendanceStatus;
  /** 1ch: 한글자(매트릭스 셀 등), 2ch: 두글자(출결 테이블·라벨) */
  variant?: "1ch" | "2ch";
}) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  const text = variant === "1ch" ? meta.short : meta.label;
  const sizeClass = variant === "1ch" ? "ds-status-badge ds-status-badge--1ch" : "ds-status-badge";

  return (
    <span
      className={sizeClass}
      style={meta.style}
      title={meta.label}
    >
      {text}
    </span>
  );
}
