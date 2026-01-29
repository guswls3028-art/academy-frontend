// PATH: src/features/staff/components/StatusBadge.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/**
 * StatusBadge – 실무 단일 기준
 *
 * 원칙:
 * - 색상 + 텍스트만으로 상태 즉시 인지
 * - danger = 불변 / 위험 / 되돌릴 수 없음
 * - success = 정상 / 확정 / 승인
 * - neutral = 정보 / 대기
 */

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

type Tone = "neutral" | "success" | "danger" | "primary";
type Density = "soft" | "solid";

const BASE =
  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border leading-none";

function toneClass(tone: Tone, density: Density = "soft") {
  if (density === "solid") {
    if (tone === "danger")
      return "bg-[var(--color-danger)] text-white border-[var(--color-danger)]";
    if (tone === "success")
      return "bg-[var(--color-success)] text-white border-[var(--color-success)]";
    if (tone === "primary")
      return "bg-[var(--color-primary)] text-white border-[var(--color-primary)]";
    return "bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-divider)]";
  }

  if (tone === "success")
    return "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_55%,transparent)]";
  if (tone === "danger")
    return "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_55%,transparent)]";
  if (tone === "primary")
    return "bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[color-mix(in_srgb,var(--color-primary)_55%,transparent)]";

  return "bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-divider)]";
}

function Dot({ tone }: { tone: Tone }) {
  const cls =
    tone === "danger"
      ? "bg-[var(--color-danger)]"
      : tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "primary"
      ? "bg-[var(--color-primary)]"
      : "bg-[var(--text-muted)]";

  return <span className={cx("inline-block h-1.5 w-1.5 rounded-full", cls)} />;
}

/* =========================
   Expense Status
========================= */

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const label =
    status === "APPROVED" ? "승인" : status === "REJECTED" ? "반려" : "대기";

  const tone: Tone =
    status === "APPROVED"
      ? "success"
      : status === "REJECTED"
      ? "danger"
      : "neutral";

  return (
    <span className={cx(BASE, toneClass(tone))}>
      <Dot tone={tone} />
      {label}
    </span>
  );
}

/* =========================
   Lock Status
========================= */

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
    <span className={cx(BASE, toneClass(tone))}>
      <Dot tone={tone} />
      {locked ? (compact ? "마감" : "🔒 마감") : compact ? "진행" : "🔓 진행중"}
    </span>
  );
}

/* =========================
   Role
========================= */

export function RoleBadge({ isManager }: { isManager: boolean }) {
  const tone: Tone = isManager ? "primary" : "neutral";

  return (
    <span className={cx(BASE, toneClass(tone))}>
      <Dot tone={tone} />
      {isManager ? "관리자" : "직원"}
    </span>
  );
}
