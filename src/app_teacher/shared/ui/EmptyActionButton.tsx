import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./EmptyActionButton.module.css";

type EmptyActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

export function EmptyActionButton({
  children,
  onClick,
  variant = "primary",
}: EmptyActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(styles.button, variant === "secondary" && styles.secondary)}
    >
      {children}
    </button>
  );
}
