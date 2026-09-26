import type { CSSProperties } from "react";
import { Check, CircleAlert } from "lucide-react";

import { Badge, ICON } from "@/shared/ui/ds";

import styles from "./AssessmentReadinessStrip.module.css";

export type AssessmentReadinessItem = {
  id: string;
  label: string;
  summary: string;
  state: "ready" | "attention";
  targetId?: string;
};

type Props = {
  title: string;
  description: string;
  items: AssessmentReadinessItem[];
  compactWhenReady?: boolean;
};

function moveToTarget(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

export default function AssessmentReadinessStrip({ title, description, items, compactWhenReady = false }: Props) {
  const readyCount = items.filter((item) => item.state === "ready").length;
  const attentionCount = items.length - readyCount;

  const itemList = (
    <ol
        className={styles.track}
        aria-label={`${readyCount}/${items.length} 항목 준비됨`}
        style={{ "--assessment-readiness-columns": items.length } as CSSProperties}
      >
        {items.map((item) => {
          const content = (
            <>
              <span className={styles.icon} data-state={item.state} aria-hidden>
                {item.state === "ready" ? (
                  <Check size={ICON.sm} strokeWidth={2.4} />
                ) : (
                  <CircleAlert size={ICON.sm} strokeWidth={2.2} />
                )}
              </span>
              <span className={styles.copy}>
                <strong>{item.label}</strong>
                <small>{item.summary}</small>
              </span>
            </>
          );

          return (
            <li key={item.id} className={styles.item} data-state={item.state}>
              {item.targetId ? (
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => moveToTarget(item.targetId!)}
                  aria-label={`${item.label}: ${item.summary}. 설정으로 이동`}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.itemButton}>{content}</div>
              )}
            </li>
          );
        })}
    </ol>
  );

  if (compactWhenReady && attentionCount === 0) {
    return (
      <details className={styles.compactRoot} aria-label={title}>
        <summary className={styles.compactSummary}>
          <span className={styles.compactStatus}><Check size={ICON.sm} aria-hidden /> {title} 완료</span>
          <span className={styles.compactHint}>{items.length}개 항목 보기</span>
        </summary>
        {itemList}
      </details>
    );
  }

  return (
    <section className={styles.root} aria-label={title}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>운영 준비</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
        </div>
        <Badge
          tone={attentionCount === 0 ? "success" : "warning"}
          size="md"
          shape="square"
        >
          {attentionCount === 0 ? "준비 완료" : `${attentionCount}개 확인 필요`}
        </Badge>
      </div>
      {itemList}
    </section>
  );
}
