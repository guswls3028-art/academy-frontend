// PATH: src/app_promo/domains/landing/components/CtaSection.tsx
import { Link } from "react-router-dom";
import { CONSULT_PHONE_DISPLAY, CONSULT_PHONE_TEL } from "../business";
import styles from "./CtaSection.module.css";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
}

export default function CtaSection({
  title = "지금 데모를 요청하고 강사님의 수업에 맞는 시작 방식을 상담받아보세요.",
  subtitle = "무료 상담으로 시작하세요. 수업 환경에 맞춘 맞춤 제안을 드립니다.",
}: CtaSectionProps) {
  return (
    <section className={styles.cta} aria-labelledby="promo-cta-title">
      <div className={styles.inner}>
        <span>CONSULTATION</span>
        <h2 id="promo-cta-title">{title}</h2>
        <p>{subtitle}</p>
        <div className={styles.actions}>
          <a href={CONSULT_PHONE_TEL}>전화 상담 {CONSULT_PHONE_DISPLAY}</a>
          <Link to="/promo/demo">데모 요청</Link>
          <Link to="/promo/contact">문의하기</Link>
        </div>
      </div>
    </section>
  );
}
