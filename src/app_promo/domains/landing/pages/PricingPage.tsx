// PATH: src/app_promo/domains/landing/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import {
  AUGUST_PRICE_GUARANTEE,
  AUGUST_PROMOTION_LABEL,
  CONSULT_PHONE_DISPLAY,
  AUGUST_MONTHLY_SUPPLY_AMOUNT,
  AUGUST_MONTHLY_TAX_AMOUNT,
  AUGUST_MONTHLY_TOTAL_AMOUNT,
  POST_AUGUST_MONTHLY_SUPPLY_AMOUNT,
  POST_AUGUST_MONTHLY_TAX_AMOUNT,
  POST_AUGUST_MONTHLY_TOTAL_AMOUNT,
  MONTHLY_VAT_RATE_PERCENT,
  PRICE_POLICY_NOTES,
  PROMO_PLANS,
  formatKoreanPrice,
} from "../business";
import styles from "./PricingPage.module.css";

function PlanAction({ href, label, popular, phone }: { href: string; label: string; popular?: boolean; phone?: boolean }) {
  const className = `${styles.planAction} ${popular ? styles.planActionFeatured : ""}`;

  if (phone) {
    return <PhoneInquiryLink className={className}>{label}</PhoneInquiryLink>;
  }
  return <Link to={href} className={className}>{label}</Link>;
}

function PriceOption({
  label,
  supplyAmount,
  taxAmount,
  totalAmount,
  highlighted,
}: {
  label: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  highlighted?: boolean;
}) {
  return (
    <div data-highlight={highlighted ? "true" : undefined}>
      <span>{label}</span>
      <strong>{formatKoreanPrice(supplyAmount)}</strong>
      <small>월 요금 · 부가세 {MONTHLY_VAT_RATE_PERCENT}% 별도</small>
      <em className={styles.priceBreakdown}>
        부가세 {formatKoreanPrice(taxAmount)} · 결제금액 {formatKoreanPrice(totalAmount)}
      </em>
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="pricing-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{AUGUST_PROMOTION_LABEL}</span>
            <h1 id="pricing-title">
              8월 가입 {formatKoreanPrice(AUGUST_MONTHLY_SUPPLY_AMOUNT)}
              <small>월 요금 · 부가세 {MONTHLY_VAT_RATE_PERCENT}% 별도</small>
            </h1>
            <p>
              2026년 8월에 가입하면 월 14만 5천원의 공급가가 이용 기간 동안 유지됩니다.
              9월 이후 가입 공급가는 월 18만원입니다.
            </p>
            <div className={styles.heroActions}>
              <PhoneInquiryLink className={styles.primaryCta}>
                전화 상담 {CONSULT_PHONE_DISPLAY}
              </PhoneInquiryLink>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                사용할 기능 확인
              </Link>
            </div>
          </div>

          <aside className={styles.priceBrief} aria-label="요금 기준 요약">
            <div className={styles.priceBriefOption}>
              <PriceOption
                label="2026년 8월 가입"
                supplyAmount={AUGUST_MONTHLY_SUPPLY_AMOUNT}
                taxAmount={AUGUST_MONTHLY_TAX_AMOUNT}
                totalAmount={AUGUST_MONTHLY_TOTAL_AMOUNT}
                highlighted
              />
            </div>
            <div className={styles.priceBriefOption}>
              <PriceOption
                label="2026년 9월 이후 가입"
                supplyAmount={POST_AUGUST_MONTHLY_SUPPLY_AMOUNT}
                taxAmount={POST_AUGUST_MONTHLY_TAX_AMOUNT}
                totalAmount={POST_AUGUST_MONTHLY_TOTAL_AMOUNT}
              />
            </div>
            <p>8월 가입 요금은 서비스를 이용하는 동안 계속 적용됩니다.</p>
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
                  <div className={styles.priceComparison}>
                    <PriceOption
                      label="8월 가입"
                      supplyAmount={plan.monthlySupplyAmount}
                      taxAmount={plan.monthlyTaxAmount}
                      totalAmount={plan.monthlyTotalAmount}
                      highlighted
                    />
                    <PriceOption
                      label="9월 이후 가입"
                      supplyAmount={plan.postAugustMonthlySupplyAmount}
                      taxAmount={plan.postAugustMonthlyTaxAmount}
                      totalAmount={plan.postAugustMonthlyTotalAmount}
                    />
                  </div>
                  <div className={styles.savingsLine}>
                    8월 가입 시 월 {formatKoreanPrice(plan.monthlySavings)} 차이
                  </div>
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
