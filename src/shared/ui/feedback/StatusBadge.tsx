// PATH: src/shared/ui/feedback/StatusBadge.tsx

type Status =
  | "pass"
  | "fail"
  | "pending"
  | "clinic-exam"
  | "clinic-homework"
  | "clinic-both";

export default function StatusBadge({
  status,
}: {
  status: Status;
}) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";

  const map: Record<Status, { label: string; cls: string }> = {
    pass: {
      label: "PASS",
      cls: `
        border-[var(--color-success)]
        bg-[var(--color-success-soft)]
        text-[var(--color-success)]
      `,
    },
    fail: {
      label: "FAIL",
      cls: `
        border-[var(--color-danger)]
        bg-[var(--color-danger-soft)]
        text-[var(--color-danger)]
      `,
    },
    pending: {
      label: "-",
      cls: `
        border-[var(--border-divider)]
        bg-[var(--bg-surface-soft)]
        text-[var(--text-muted)]
      `,
    },
    "clinic-exam": {
      label: "시험",
      cls: `
        border-[var(--border-divider)]
        bg-[var(--bg-surface-soft)]
        text-[var(--text-secondary)]
      `,
    },
    "clinic-homework": {
      label: "과제",
      cls: `
        border-[var(--border-divider)]
        bg-[var(--bg-surface-soft)]
        text-[var(--text-secondary)]
      `,
    },
    "clinic-both": {
      label: "시험+과제",
      cls: `
        border-[var(--color-danger)]
        bg-[var(--color-danger-soft)]
        text-[var(--color-danger)]
      `,
    },
  };

  const item = map[status];

  return <span className={`${base} ${item.cls}`}>{item.label}</span>;
}
