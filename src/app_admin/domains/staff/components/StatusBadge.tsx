// PATH: src/app_admin/domains/staff/components/StatusBadge.tsx
// 전역 SSOT: shared/ui/ds Badge (variant=solid)

import { Badge, type BadgeTone } from "@/shared/ui/ds";
import styles from "./StatusBadge.module.css";

type Tone = "neutral" | "success" | "danger" | "warning" | "primary";

function Dot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={styles.dot} data-tone={tone} />;
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
