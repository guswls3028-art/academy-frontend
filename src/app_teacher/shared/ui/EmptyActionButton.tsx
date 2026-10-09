import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./EmptyActionButton.module.css";

type EmptyActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function EmptyActionButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: EmptyActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(styles.button, variant === "secondary" && styles.secondary)}
    >
      {children}
    </button>
  );
}
