// PATH: src/app_promo/domains/landing/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import {
  PRICE_POLICY_NOTES,
  PROMO_PLANS,
  formatWon,
} from "../business";
import styles from "./PricingPage.module.css";

function PlanAction({ href, label, popular, phone }: { href: string; label: string; popular?: boolean; phone?: boolean }) {
  const className = `${styles.planAction} ${popular ? styles.planActionFeatured : ""}`;

  if (phone) {
    return <PhoneInquiryLink className={className}>{label}</PhoneInquiryLink>;
  }
  return <Link to={href} className={className}>{label}</Link>;
}

export default function PricingPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="pricing-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>요금 안내</span>
            <h1 id="pricing-title">월 159,000원, 모든 기능을 함께 씁니다</h1>
            <p>
              기능별 등급과 상위 플랜 없이 하나의 요금제로 운영합니다.
              공급가, 부가가치세, 실제 결제 총액을 모두 공개합니다.
            </p>
            <div className={styles.heroActions}>
              <PhoneInquiryLink className={styles.primaryCta}>전화 문의</PhoneInquiryLink>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                도입 범위 확인
              </Link>
            </div>
          </div>

          <aside className={styles.priceBrief} aria-label="요금 기준 요약">
            <span>월 결제 총액</span>
            <strong>159,000원</strong>
            <p>모든 기능 포함 · 월 구독</p>
            <dl>
              <div>
                <dt>공급가</dt>
                <dd>145,000원</dd>
              </div>
              <div>
                <dt>부가가치세</dt>
                <dd>14,000원</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.planSection} aria-labelledby="plan-title">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHead}>
            <span>단일 요금제</span>
            <h2 id="plan-title">필요한 기능을 전부 포함했습니다</h2>
            <p>수강생 수나 계정 수로 기능을 나누지 않습니다.</p>
          </div>

          <div className={styles.planGrid}>
            {PROMO_PLANS.map((plan) => (
              <article
                key={plan.key}
                className={styles.planCard}
                data-plan={plan.key}
                data-popular={plan.popular ? "true" : undefined}
              >
                {plan.popular && <span className={styles.popularBadge}>모든 기능 포함</span>}

                <div className={styles.planTop}>
                  <span>{plan.positioning}</span>
                  <h3>{plan.name}</h3>
                  <p>{plan.target}</p>
                </div>

                <div className={styles.priceLine}>
                  <strong>{formatWon(plan.monthlyTotalAmount)}</strong>
                  <span>원 / 월</span>
                  <small>
                    공급가 {formatWon(plan.monthlySupplyAmount)}원 + 부가가치세 {formatWon(plan.monthlyTaxAmount)}원
                  </small>
                </div>

                <p className={styles.verdict}>{plan.verdict}</p>

                <dl className={styles.planSpecs}>
                  <div>
                    <dt>수강생</dt>
                    <dd>{plan.studentLimit}</dd>
                  </div>
                  <div>
                    <dt>계정</dt>
                    <dd>{plan.adminLimit}</dd>
                  </div>
                  <div>
                    <dt>저장</dt>
                    <dd>{plan.storage}</dd>
                  </div>
                  <div>
                    <dt>기능</dt>
                    <dd>모두 포함</dd>
                  </div>
                </dl>

                <ul className={styles.featureList}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <PlanAction href={plan.ctaLink} label={plan.cta} popular={plan.popular} phone={plan.ctaKind === "phone"} />
              </article>
            ))}
          </div>

          <div className={styles.policyBox}>
            <div>
              <span>비용 기준</span>
              <h2>비용이 달라지는 기준</h2>
            </div>
            <ul>
              {PRICE_POLICY_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaSection
        title="하나의 요금제로 모든 기능을 확인하세요"
        subtitle="실제 수업 방식에 맞춘 데모와 도입 일정을 함께 정리합니다."
      />
    </>
  );
}
