import { Link } from "react-router";
import styles from "./PageTrail.module.css";

export type PageCrumb = { label: string; to?: string };

/** Parent locations stay separate from the current page's heading. */
export default function PageTrail({ items, tone = "admin" }: {
  items: PageCrumb[];
  tone?: "admin" | "student";
}) {
  if (!items.length) return null;
  return (
    <nav aria-label="상위 경로" className={styles.trail} data-tone={tone}>
      <ol>
        {items.map((item, index) => (
          <li key={`${index}-${item.to ?? item.label}`}>
            {index > 0 && <span className={styles.separator} aria-hidden="true">/</span>}
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
