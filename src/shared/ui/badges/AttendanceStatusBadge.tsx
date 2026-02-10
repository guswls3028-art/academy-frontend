// PATH: src/shared/ui/badges/AttendanceStatusBadge.tsx
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

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; className: string }
> = {
  PRESENT: {
    label: "현장",
    className: "bg-[var(--color-primary)] text-white",
  },
  LATE: {
    label: "지각",
    className: "bg-yellow-500 text-white",
  },
  ONLINE: {
    label: "영상",
    className: "bg-sky-500 text-white",
  },
  SUPPLEMENT: {
    label: "보강",
    className: "bg-violet-500 text-white",
  },
  EARLY_LEAVE: {
    label: "조퇴",
    className: "bg-amber-500 text-white",
  },
  ABSENT: {
    label: "결석",
    className: "bg-red-500 text-white",
  },
  RUNAWAY: {
    label: "출튀",
    className: "bg-rose-500 text-white",
  },
  MATERIAL: {
    label: "자료",
    className: "bg-slate-500 text-white",
  },
  INACTIVE: {
    label: "부재",
    className: "bg-gray-400 text-white",
  },
  SECESSION: {
    label: "퇴원",
    className: "bg-gray-700 text-white",
  },
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
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        meta.className,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}
