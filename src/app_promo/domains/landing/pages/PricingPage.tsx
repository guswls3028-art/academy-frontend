// PATH: src/app_promo/domains/landing/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import {
  AUGUST_PRICE_GUARANTEE,
  AUGUST_PROMOTION_LABEL,
  AUGUST_MONTHLY_SUPPLY_AMOUNT,
  POST_AUGUST_MONTHLY_SUPPLY_AMOUNT,
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

export default function PricingPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="pricing-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{AUGUST_PROMOTION_LABEL}</span>
            <h1 id="pricing-title">
              8월 가입 {formatKoreanPrice(AUGUST_MONTHLY_SUPPLY_AMOUNT)}
              <small>월 요금 · 부가세 별도</small>
            </h1>
            <p>
              2026년 8월 1일부터 31일까지 가입하면 월 14만 5천원 요금이 이용 기간 동안
              유지됩니다. 8월 이후 가입 요금은 월 16만원입니다.
            </p>
            <div className={styles.heroActions}>
              <PhoneInquiryLink className={styles.primaryCta}>전화 문의</PhoneInquiryLink>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                사용할 기능 확인
              </Link>
            </div>
          </div>

          <aside className={styles.priceBrief} aria-label="요금 기준 요약">
            <div className={styles.priceBriefOption} data-highlight="true">
              <span>2026년 8월 가입</span>
              <strong>{formatKoreanPrice(AUGUST_MONTHLY_SUPPLY_AMOUNT)}</strong>
              <small>월 요금 · 부가세 별도</small>
            </div>
            <div className={styles.priceBriefOption}>
              <span>2026년 8월 이후 가입</span>
              <strong>{formatKoreanPrice(POST_AUGUST_MONTHLY_SUPPLY_AMOUNT)}</strong>
              <small>월 요금 · 부가세 별도</small>
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
                    <div data-highlight="true">
                      <span>8월 가입</span>
                      <strong>{formatKoreanPrice(plan.monthlySupplyAmount)}</strong>
                      <small>월 요금 · 부가세 별도</small>
                    </div>
                    <div>
                      <span>8월 이후 가입</span>
                      <strong>{formatKoreanPrice(plan.postAugustMonthlySupplyAmount)}</strong>
                      <small>월 요금 · 부가세 별도</small>
                    </div>
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
