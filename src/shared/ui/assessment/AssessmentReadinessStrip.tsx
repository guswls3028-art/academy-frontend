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
};

function moveToTarget(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

export default function AssessmentReadinessStrip({ title, description, items }: Props) {
  const readyCount = items.filter((item) => item.state === "ready").length;
  const attentionCount = items.length - readyCount;

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

      <ol className={styles.track} aria-label={`${readyCount}/${items.length} 항목 준비됨`}>
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
    </section>
  );
}
