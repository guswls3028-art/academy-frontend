import { useEffect } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { Badge } from "@/shared/ui/ds";
import { PRODUCT_UPDATES, type ProductUpdate } from "./productUpdates";
import { useProductUpdateAwareness } from "./useProductUpdateAwareness";
import styles from "./ProductUpdateNotes.module.css";

const UPDATE_KIND = {
  new: { label: "새 기능", tone: "success" },
  improve: { label: "개선", tone: "info" },
  fix: { label: "수정", tone: "neutral" },
} as const;

function UpdateDetails({ update }: { update: ProductUpdate }) {
  return (
    <>
      <p>{update.summary}</p>
      <p className={styles.scope}>{update.audience.join(" · ")} · {update.availability}</p>
      <ul className={styles.highlights}>
        {update.highlights.map(({ kind, text }) => (
          <li key={text}>
            <Badge tone={UPDATE_KIND[kind].tone}>{UPDATE_KIND[kind].label}</Badge>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ProductUpdateNotes() {
  const [latest, ...previous] = PRODUCT_UPDATES;
  return (
    <div className={styles.notes}>
      <article className={styles.latest}>
        <time dateTime={latest.date}>{latest.date}</time>
        <h3>{latest.title}</h3>
        <UpdateDetails update={latest} />
      </article>
      <section className={styles.archive} aria-label="이전 패치노트">
        <h3>이전 패치노트</h3>
        {previous.map((update) => (
          <details key={update.id} className={styles.previous}>
            <summary>
              <time dateTime={update.date}>{update.date}</time>
              <strong>{update.title}</strong>
            </summary>
            <UpdateDetails update={update} />
          </details>
        ))}
      </section>
    </div>
  );
}

export default function ProductUpdatePage() {
  const { user } = useAuth();
  const { markRead } = useProductUpdateAwareness(user?.id);
  useEffect(markRead, [markRead]);

  return (
    <section className={styles.page}>
      <h1>패치노트</h1>
      <ProductUpdateNotes />
    </section>
  );
}
