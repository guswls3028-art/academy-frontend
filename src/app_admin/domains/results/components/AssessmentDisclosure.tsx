import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import styles from "./AssessmentDisclosure.module.css";

export function AssessmentDisclosure({ title, summary, onToggle, contentClassName, children }: {
  title: string;
  summary?: ReactNode;
  onToggle?: (open: boolean) => void;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.root} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary className={styles.trigger}>
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
        <ChevronDown className={styles.chevron} size={ICON.sm} aria-hidden />
      </summary>
      <section aria-label={title} className={contentClassName ? `${styles.content} ${contentClassName}` : styles.content}>
        {children}
      </section>
    </details>
  );
}
