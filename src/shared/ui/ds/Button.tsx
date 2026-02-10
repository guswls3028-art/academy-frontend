// PATH: src/shared/ui/ds/Button.tsx
import React from "react";

export type ButtonIntent = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  intent?: ButtonIntent;
  size?: ButtonSize;

  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  loading?: boolean;
  className?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Button({
  intent = "secondary",
  size = "md",
  iconOnly,
  leftIcon,
  rightIcon,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = !!disabled || !!loading;

  return (
    <button
      {...props}
      type={(props.type as any) ?? "button"}
      disabled={isDisabled}
      className={cx("ds-button", className)}
      data-intent={intent}
      data-size={size}
      data-icon-only={iconOnly ? "true" : "false"}
      data-loading={loading ? "true" : "false"}
      data-disabled={isDisabled ? "true" : "false"}
    >
      {loading && <span className="ds-button__spinner" aria-hidden />}

      {!loading && leftIcon && (
        <span className="ds-button__left" aria-hidden>
          {leftIcon}
        </span>
      )}

      {!iconOnly && <span className="ds-button__label">{children}</span>}

      {!loading && rightIcon && (
        <span className="ds-button__right" aria-hidden>
          {rightIcon}
        </span>
      )}
    </button>
  );
}
