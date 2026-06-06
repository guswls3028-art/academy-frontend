// PATH: src/app_promo/domains/landing/components/CtaSection.tsx
import { Link } from "react-router-dom";
import PhoneInquiryLink from "./PhoneInquiryLink";
import styles from "./CtaSection.module.css";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
}

export default function CtaSection({
  title = "현재 수업 방식에 맞는 시작 범위를 확인하세요.",
  subtitle = "출결, 채점, 영상, 알림톡 중 먼저 정리할 업무를 함께 좁혀봅니다.",
}: CtaSectionProps) {
  return (
    <section className={styles.cta} aria-labelledby="promo-cta-title">
      <div className={styles.inner}>
        <span>도입 상담</span>
        <h2 id="promo-cta-title">{title}</h2>
        <p>{subtitle}</p>
        <div className={styles.actions}>
          <PhoneInquiryLink>전화 문의</PhoneInquiryLink>
          <Link to="/promo/demo">데모 요청</Link>
          <Link to="/promo/contact">문의하기</Link>
        </div>
      </div>
    </section>
  );
}
