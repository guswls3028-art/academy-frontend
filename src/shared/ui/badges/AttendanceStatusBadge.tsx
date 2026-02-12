// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
import React from "react";

type AttendanceStatus =
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

/** 출결 상태별 고유 색상 (전역 하드코딩 — 테마 무관) */
const STATUS_META: Record<
  AttendanceStatus,
  { label: string; style: React.CSSProperties }
> = {
  PRESENT: { label: "현장", style: { backgroundColor: "#22c55e", color: "#fff" } },
  LATE: { label: "지각", style: { backgroundColor: "#f59e0b", color: "#fff" } },
  ONLINE: { label: "영상", style: { backgroundColor: "#3b82f6", color: "#fff" } },
  SUPPLEMENT: { label: "보강", style: { backgroundColor: "#14b8a6", color: "#fff" } },
  EARLY_LEAVE: { label: "조퇴", style: { backgroundColor: "#eab308", color: "#1f2937" } },
  ABSENT: { label: "결석", style: { backgroundColor: "#ef4444", color: "#fff" } },
  RUNAWAY: { label: "출튀", style: { backgroundColor: "#dc2626", color: "#fff" } },
  MATERIAL: { label: "자료", style: { backgroundColor: "#e2e8f0", color: "#475569" } },
  INACTIVE: { label: "부재", style: { backgroundColor: "#f1f5f9", color: "#64748b" } },
  SECESSION: { label: "퇴원", style: { backgroundColor: "#64748b", color: "#fff" } },
};

export default function AttendanceStatusBadge({
  status,
}: {
  status: AttendanceStatus;
}) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
      style={meta.style}
    >
      {meta.label}
    </span>
  );
}
