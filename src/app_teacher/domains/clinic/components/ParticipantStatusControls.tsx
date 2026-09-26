export function SmallBtn({
  label,
  color,
  onClick,
  disabled = false,
  title,
}: {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="min-h-11 text-xs font-semibold px-2 py-1.5 rounded cursor-pointer"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: "none",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "승인 대기", color: "var(--tc-warning)" },
  booked: { label: "미등원", color: "var(--tc-info)" },
  attended: { label: "등원", color: "var(--tc-success)" },
  no_show: { label: "결석", color: "var(--tc-danger)" },
  cancelled: { label: "취소", color: "var(--tc-text-muted)" },
  rejected: { label: "거절", color: "var(--tc-text-muted)" },
};

export function StatusBadge({ status, isLate, checkedOut }: { status: string; isLate: boolean; checkedOut: boolean }) {
  const base = STATUS_LABELS[status] ?? { label: status === "unknown" ? "상태 확인 필요" : status, color: "var(--tc-text-muted)" };
  const st = checkedOut
    ? { label: "하원 완료", color: "var(--tc-primary)" }
    : isLate && status === "attended"
    ? { label: "지각 등원", color: "var(--tc-warning)" }
    : base;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}
    >
      {st.label}
    </span>
  );
}
