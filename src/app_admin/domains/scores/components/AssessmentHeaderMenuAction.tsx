import type { ReactNode } from "react";
import styles from "./ExamHeaderActionMenu.module.css";

type Props = {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export default function AssessmentHeaderMenuAction({
  title,
  description,
  icon,
  accent = false,
  disabled = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${styles.menuAction} ${accent ? styles.menuActionAccent : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.menuActionIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.menuActionCopy}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}
