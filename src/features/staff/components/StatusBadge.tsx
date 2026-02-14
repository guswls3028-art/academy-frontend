// PATH: src/features/staff/components/StatusBadge.tsx
// 전역 SSOT: .ds-status-badge + data-tone (styles/design-system/ds/status.css)

import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "success" | "danger" | "warning" | "primary";

function Dot({ tone }: { tone: Tone }) {
  const cls =
    tone === "danger"
      ? "bg-[var(--color-danger)]"
      : tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "warning"
      ? "bg-[var(--color-warning)]"
      : tone === "primary"
      ? "bg-[var(--color-brand-primary)]"
      : "bg-[var(--color-text-muted)]";

  return <span className={cx("inline-block h-1.5 w-1.5 rounded-full shrink-0", cls)} aria-hidden />;
}

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const label =
    status === "APPROVED" ? "승인" : status === "REJECTED" ? "반려" : "대기";
  const tone: Tone =
    status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "neutral";

  return (
    <span className="ds-status-badge" data-tone={tone}>
      <Dot tone={tone} />
      {label}
    </span>
  );
}

export function LockBadge({
  state,
  compact = false,
}: {
  state: "LOCKED" | "OPEN";
  compact?: boolean;
}) {
  const locked = state === "LOCKED";
  const tone: Tone = locked ? "danger" : "success";

  return (
    <span className="ds-status-badge" data-tone={tone}>
      <Dot tone={tone} />
      {locked ? (compact ? "마감" : "🔒 마감") : compact ? "진행" : "🔓 진행중"}
    </span>
  );
}

export function RoleBadge({ isManager }: { isManager: boolean }) {
  const tone: Tone = isManager ? "primary" : "neutral";

  return (
    <span className="ds-status-badge" data-tone={tone}>
      <Dot tone={tone} />
      {isManager ? "관리자" : "직원"}
    </span>
  );
}
