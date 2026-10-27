import { Link } from "react-router";
import { ArrowRight, BookOpenCheck, CreditCard } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { PLANNED_PAYMENT_NOTICE } from "../business";
import styles from "./GettingStartedSection.module.css";

export default function GettingStartedSection() {
  return (
    <section className={styles.section} aria-label="사용 가이드와 도입 예정 기능">
      <div className={styles.grid}>
        <article className={styles.card}>
          <BookOpenCheck size={ICON.lg} aria-hidden="true" />
          <span className={styles.label}>사용 가이드</span>
          <h2>역할별 사용 가이드</h2>
          <p>관리자, 직원·강사, 학생의 기능별 사용 방법과 문제 해결 안내입니다.</p>
          <Link to="/promo/guide">
            전체 사용 가이드 보기 <ArrowRight size={ICON.md} aria-hidden="true" />
          </Link>
        </article>
        <article className={styles.card}>
          <CreditCard size={ICON.lg} aria-hidden="true" />
          <span className={styles.label}>도입 예정</span>
          <h2>원비·교재비 온라인 결제</h2>
          <p>{PLANNED_PAYMENT_NOTICE}</p>
          <p className={styles.note}>학원플러스 서비스 이용료와 별개로, 학원이 원비·교재비를 받는 기능입니다.</p>
        </article>
      </div>
    </section>
  );
}
