// PATH: src/app_promo/domains/landing/components/CtaSection.tsx
import { Link } from "react-router";
import { CONSULT_CALLBACK_NOTICE, CONSULT_PHONE_DISPLAY } from "../business";
import PhoneInquiryLink from "./PhoneInquiryLink";
import styles from "./CtaSection.module.css";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
  secondaryPath?: string;
  secondaryLabel?: string;
}

export default function CtaSection({
  title = "이용 문의",
  subtitle = "궁금한 기능과 이용 조건을 안내해 드립니다.",
  secondaryPath = "/promo/contact",
  secondaryLabel = "문의하기",
}: CtaSectionProps) {
  return (
    <section className={styles.cta} aria-labelledby="promo-cta-title">
      <div className={styles.inner}>
        <h2 id="promo-cta-title">{title}</h2>
        <p>{subtitle}</p>
        <div className={styles.actions}>
          <Link to="/promo/demo">시연 신청</Link>
          <Link to={secondaryPath}>{secondaryLabel}</Link>
        </div>
        <p className={styles.phoneNote}>
          전화 상담 <PhoneInquiryLink>{CONSULT_PHONE_DISPLAY}</PhoneInquiryLink>
        </p>
        <p className={styles.phoneNote}>{CONSULT_CALLBACK_NOTICE}</p>
      </div>
    </section>
  );
}
