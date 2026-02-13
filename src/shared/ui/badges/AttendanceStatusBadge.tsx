// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
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

/** 출결 상태별 라벨·한글자·색상 */
const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; style: React.CSSProperties }
> = {
  PRESENT: { label: "현장", short: "출", style: { backgroundColor: "#22c55e", color: "#fff" } },
  LATE: { label: "지각", short: "지", style: { backgroundColor: "#f59e0b", color: "#fff" } },
  ONLINE: { label: "영상", short: "온", style: { backgroundColor: "#3b82f6", color: "#fff" } },
  SUPPLEMENT: { label: "보강", short: "보", style: { backgroundColor: "#14b8a6", color: "#fff" } },
  EARLY_LEAVE: { label: "조퇴", short: "조", style: { backgroundColor: "#eab308", color: "#1f2937" } },
  ABSENT: { label: "결석", short: "결", style: { backgroundColor: "#ef4444", color: "#fff" } },
  RUNAWAY: { label: "출튀", short: "튀", style: { backgroundColor: "#dc2626", color: "#fff" } },
  MATERIAL: { label: "자료", short: "자", style: { backgroundColor: "#e2e8f0", color: "#475569" } },
  INACTIVE: { label: "부재", short: "부", style: { backgroundColor: "#f1f5f9", color: "#64748b" } },
  SECESSION: { label: "퇴원", short: "탈", style: { backgroundColor: "#64748b", color: "#fff" } },
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

export default function AttendanceStatusBadge({
  status,
  variant = "full",
}: {
  status: AttendanceStatus;
  /** full: 두글자 라벨, short: 한글자(매트릭스용) */
  variant?: "full" | "short";
}) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  const text = variant === "short" ? meta.short : meta.label;
  const isShort = variant === "short";

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold ${isShort ? "rounded px-1.5 py-0.5 text-xs min-w-[1.25rem]" : "rounded-full px-3 py-1.5 text-sm"}`}
      style={meta.style}
      title={meta.label}
    >
      {text}
    </span>
  );
}
