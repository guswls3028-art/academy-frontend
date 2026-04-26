// PATH: src/app_admin/domains/staff/components/StatusBadge.tsx
// 전역 SSOT: shared/ui/ds Badge (variant=solid)

import { Badge, type BadgeTone } from "@/shared/ui/ds";

type Tone = "neutral" | "success" | "danger" | "warning" | "primary";

function Dot({ tone }: { tone: Tone }) {
  const map: Record<Tone, string> = {
    danger: "var(--color-danger)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    primary: "var(--color-brand-primary)",
    neutral: "var(--color-text-muted)",
  };
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 999,
        flexShrink: 0,
        background: map[tone],
      }}
    />
  );
}

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const label =
    status === "APPROVED" ? "승인" : status === "REJECTED" ? "반려" : "대기";
  const tone: Tone =
    status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "neutral";

  return (
    <Badge variant="solid" tone={tone as BadgeTone}>
      <Dot tone={tone} />
      {label}
    </Badge>
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
    <Badge variant="solid" tone={tone as BadgeTone}>
      <Dot tone={tone} />
      {locked ? (compact ? "마감" : "🔒 마감") : compact ? "진행" : "🔓 진행중"}
    </Badge>
  );
}

export function RoleBadge({ isManager }: { isManager: boolean }) {
  const tone: Tone = isManager ? "primary" : "neutral";

  return (
    <Badge variant="solid" tone={tone as BadgeTone}>
      <Dot tone={tone} />
      {isManager ? "관리자" : "직원"}
    </Badge>
  );
}
