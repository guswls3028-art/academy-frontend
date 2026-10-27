import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import type { PromoQuestion } from "../promoQuestions";
import styles from "./PromoQuestions.module.css";

export default function PromoQuestions({ questions }: { questions: PromoQuestion[] }) {
  const root = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    const target = Array.from(root.current?.querySelectorAll("details") ?? []).find(item => `#${item.id}` === hash);
    if (target) target.open = true;
  }, [hash]);
  return <div ref={root} className={styles.questions}>
    {questions.map(item => <details key={item.id} id={item.id}>
      <summary>{item.question}<ChevronDown size={ICON.sm} aria-hidden="true" /></summary>
      <div className={styles.answer}>
        {item.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <Link to={item.href}>{item.linkLabel}</Link>
      </div>
    </details>)}
  </div>;
}
