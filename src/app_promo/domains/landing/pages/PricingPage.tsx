// PATH: src/app_promo/domains/landing/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";
import {
  CONSULT_PHONE_DISPLAY,
  CONSULT_PHONE_TEL,
  PRICE_COMPARISON,
  PRICE_POLICY_NOTES,
  PROMO_PLANS,
  formatWon,
} from "../business";
import styles from "./PricingPage.module.css";

function PlanAction({ href, label, popular }: { href: string; label: string; popular?: boolean }) {
  const className = `${styles.planAction} ${popular ? styles.planActionFeatured : ""}`;

  if (href.startsWith("tel:")) {
    return <a href={href} className={className}>{label}</a>;
  }
  return <Link to={href} className={className}>{label}</Link>;
}

export default function PricingPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="pricing-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>PRICE DECK</span>
            <h1 id="pricing-title">요금은 단순하게, 수업 범위는 정확하게</h1>
            <p>
              월 구독료는 숨기지 않고 공개합니다. 담당 수강생 수, 함께 쓰는 계정,
              저장공간, 메시지 발송비처럼 실제 비용이 갈리는 기준도 함께 확인하세요.
            </p>
            <div className={styles.heroActions}>
              <a href={CONSULT_PHONE_TEL} className={styles.primaryCta}>
                전화 상담 {CONSULT_PHONE_DISPLAY}
              </a>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                내 수업 견적 확인
              </Link>
            </div>
          </div>

          <aside className={styles.priceBrief} aria-label="요금 기준 요약">
            <span>현재 프로모션 기준</span>
            <strong>99,000원부터</strong>
            <p>부가세 별도 · 월 구독 · 활성 수강생 수 기준</p>
            <dl>
              <div>
                <dt>주력 플랜</dt>
                <dd>Pro</dd>
              </div>
              <div>
                <dt>상담 번호</dt>
                <dd>{CONSULT_PHONE_DISPLAY}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.planSection} aria-labelledby="plan-title">
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHead}>
            <span>SELECT THE FIT</span>
            <h2 id="plan-title">강사님의 수업 규모별로 고르는 세 가지 패키지</h2>
            <p>핵심 기능은 넓게 제공하고, 실제 비용 차이는 수강생 한도와 지원 수준에서 납니다.</p>
          </div>

          <div className={styles.planGrid}>
            {PROMO_PLANS.map((plan) => (
              <article
                key={plan.key}
                className={styles.planCard}
                data-plan={plan.key}
                data-popular={plan.popular ? "true" : undefined}
              >
                {plan.popular && <span className={styles.popularBadge}>가장 현실적인 선택</span>}

                <div className={styles.planTop}>
                  <span>{plan.positioning}</span>
                  <h3>{plan.name}</h3>
                  <p>{plan.target}</p>
                </div>

                <div className={styles.priceLine}>
                  <strong>{formatWon(plan.monthlyPrice)}</strong>
                  <span>원 / 월</span>
                  <small>부가세 별도</small>
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
                    <dt>지원</dt>
                    <dd>{plan.support}</dd>
                  </div>
                </dl>

                <ul className={styles.featureList}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <PlanAction href={plan.ctaLink} label={plan.cta} popular={plan.popular} />
              </article>
            ))}
          </div>

          <div className={styles.policyBox}>
            <div>
              <span>PRICE RULE</span>
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

      <section className={styles.comparisonSection} aria-labelledby="comparison-title">
        <div className={styles.sectionWrap}>
          <div className={styles.comparisonHead}>
            <span>COMPARE</span>
            <h2 id="comparison-title">플랜별 비교</h2>
            <p>기능 포함 여부보다 수강생 한도와 지원 방식 차이를 먼저 보세요.</p>
          </div>

          <div className={styles.tableShell}>
            <table>
              <thead>
                <tr>
                  <th>항목</th>
                  <th>Standard</th>
                  <th>Pro</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td>{row.standard}</td>
                    <td>{row.pro}</td>
                    <td>{row.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CtaSection
        title="강사님의 수업 규모에 맞는 견적을 받아보세요"
        subtitle={`전화 ${CONSULT_PHONE_DISPLAY} 또는 데모 요청으로 실제 수업 조건을 확인합니다.`}
      />
    </>
  );
}
