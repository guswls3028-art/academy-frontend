// PATH: src/app_promo/domains/landing/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import {
  AUGUST_PRICE_GUARANTEE,
  AUGUST_PROMOTION_LABEL,
  AUGUST_MONTHLY_SAVINGS,
  PRICE_POLICY_NOTES,
  PROMO_PLANS,
  STANDARD_MONTHLY_TOTAL_AMOUNT,
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
            <span className={styles.eyebrow}>{AUGUST_PROMOTION_LABEL}</span>
            <h1 id="pricing-title">8월에 가입하면 월 159,000원이 계속 적용됩니다</h1>
            <p>
              가입 기간은 2026년 8월 1일부터 31일까지입니다. 평소 요금은 월 198,000원이며,
              포함 기능과 별도 비용은 아래에서 확인할 수 있습니다.
            </p>
            <div className={styles.heroActions}>
              <PhoneInquiryLink className={styles.primaryCta}>전화 문의</PhoneInquiryLink>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                사용할 기능 확인
              </Link>
            </div>
          </div>

          <aside className={styles.priceBrief} aria-label="요금 기준 요약">
            <div className={styles.standardPrice}>
              <span>기본 월 요금</span>
              <strong>{formatWon(STANDARD_MONTHLY_TOTAL_AMOUNT)}원</strong>
            </div>
            <span>8월 가입 월 요금</span>
            <strong>159,000원</strong>
            <span className={styles.priceDifference}>기본 요금과 월 {formatWon(AUGUST_MONTHLY_SAVINGS)}원 차이</span>
            <p>부가가치세 포함 · 서비스를 이용하는 동안 유지</p>
            <dl>
              <div>
                <dt>월 결제 금액</dt>
                <dd>159,000원</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.planSection} aria-labelledby="plan-title">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHead}>
            <span>한 가지 요금</span>
            <h2 id="plan-title">안내된 기능을 모두 이용할 수 있습니다</h2>
            <p>수강생 수나 계정 수에 따른 추가 요금은 없습니다.</p>
          </div>

          <div className={styles.planGrid}>
            {PROMO_PLANS.map((plan) => (
              <article
                key={plan.key}
                className={styles.planCard}
                data-plan={plan.key}
                data-popular={plan.popular ? "true" : undefined}
              >
                {plan.popular && <span className={styles.popularBadge}>한 가지 요금</span>}

                <div className={styles.planTop}>
                  <span>{plan.positioning}</span>
                  <h3>{plan.name}</h3>
                  <p>{plan.target}</p>
                </div>

                <div className={styles.priceLine}>
                  <div className={styles.standardLedger}>
                    <span>기본 월 {formatWon(plan.standardMonthlyTotalAmount)}원</span>
                    <small>
                      공급가 {formatWon(plan.standardMonthlySupplyAmount)}원 + 부가가치세 {formatWon(plan.standardMonthlyTaxAmount)}원
                    </small>
                  </div>
                  <div className={styles.savingsLine}>기본 요금 대비 월 {formatWon(plan.monthlySavings)}원 차이</div>
                  <strong>{formatWon(plan.monthlyTotalAmount)}</strong>
                  <span>원 / 월</span>
                  <small>부가가치세 포함</small>
                </div>

                <div className={styles.guaranteeBox}>
                  <strong>8월 가입 요금 안내</strong>
                  <span>{AUGUST_PRICE_GUARANTEE}</span>
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
        title="월 요금과 사용할 기능을 확인해 보세요"
        subtitle="기본 기능, 별도 비용과 시작 일정을 함께 안내합니다."
      />
    </>
  );
}
