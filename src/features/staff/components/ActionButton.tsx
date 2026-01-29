// PATH: src/features/staff/components/ActionButton.tsx
import React from "react";

type Variant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "ghost"
  | "outline"
  | "danger-outline";

type Size = "xs" | "sm" | "md";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const BASE =
  "inline-flex items-center justify-center select-none whitespace-nowrap font-semibold rounded-lg border transition " +
  "focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

const SIZE: Record<Size, string> = {
  xs: "h-[30px] px-2 text-xs",
  sm: "h-[34px] px-3 text-xs",
  md: "h-[38px] px-4 text-sm",
};

/**
 * 실무 기준 버튼 톤
 * - danger: 삭제/마감/확정 (되돌릴 수 없음)
 * - success: 승인/정상
 * - outline/ghost: 탐색·보조
 * - disabled: 시각적으로 “죽은 버튼” 명확
 */
const VARIANT: Record<Variant, string> = {
  primary:
    "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:opacity-90",
  secondary:
    "border-[var(--border-divider)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]",
  outline:
    "border-[var(--border-divider)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]",
  danger:
    "border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-95 shadow-[0_8px_18px_rgba(0,0,0,0.28)]",
  "danger-outline":
    "border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]",
  success:
    "border-[var(--color-success)] bg-[var(--color-success)] text-white hover:opacity-90",
};

export default function ActionButton({
  variant = "secondary",
  size = "sm",
  disabled,
  disabledReason,
  className,
  title,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  disabledReason?: string;
}) {
  const isDisabled = !!disabled || !!disabledReason;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      title={disabledReason || title}
      className={cx(
        BASE,
        SIZE[size],
        VARIANT[variant],
        isDisabled &&
          [
            "opacity-50 cursor-not-allowed",
            "hover:opacity-50 active:opacity-50",
            variant === "outline" ||
            variant === "ghost" ||
            variant === "danger-outline"
              ? "hover:bg-transparent"
              : "",
          ].join(" "),
        className
      )}
      {...props}
    />
  );
}
