// PATH: src/app_promo/domains/landing/components/CtaSection.tsx
import { Link } from "react-router";
import { CONSULT_PHONE_DISPLAY } from "../business";
import PhoneInquiryLink from "./PhoneInquiryLink";
import styles from "./CtaSection.module.css";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
  secondaryPath?: string;
  secondaryLabel?: string;
}

export default function CtaSection({
  title = "도입 상담",
  subtitle = "학원의 운영 방식에 맞춰 필요한 기능과 도입 절차를 안내해 드립니다.",
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
      </div>
    </section>
  );
}
