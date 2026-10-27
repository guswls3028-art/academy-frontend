import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import CtaSection from "../components/CtaSection";
import { AUGUST_MONTHLY_SUPPLY_AMOUNT, AUGUST_MONTHLY_TAX_AMOUNT, AUGUST_MONTHLY_TOTAL_AMOUNT, AUGUST_PRICE_GUARANTEE, AUGUST_PROMOTION_LABEL, MONTHLY_VAT_RATE_PERCENT, PLANNED_PAYMENT_NOTICE, POST_AUGUST_MONTHLY_SUPPLY_AMOUNT, POST_AUGUST_MONTHLY_TAX_AMOUNT, POST_AUGUST_MONTHLY_TOTAL_AMOUNT, PROMO_PLANS, START_GUIDANCE_NOTICE, formatKoreanPrice } from "../business";
import styles from "./PromoReading.module.css";

export default function PricingPage() {
  const legacyRef = useRef<HTMLDetailsElement>(null);
  const { hash } = useLocation();
  useEffect(() => { if (hash === "#existing-contract" && legacyRef.current) legacyRef.current.open = true; }, [hash]);
  const plan = PROMO_PLANS[0];
  return <>
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>요금 안내</h1>
        <p>현재 신규 가입 요금과 별도 비용입니다.<br />필요한 기능과 자료 이전 범위를 확인한 뒤 이용을 시작할 수 있습니다.</p>
      </header>
      <div className={styles.pricingGrid}>
        <article className={styles.plan} data-plan={plan.key} aria-labelledby="plan-title">
          <span className={styles.label}>2026년 9월 이후 신규 가입</span>
          <h2 id="plan-title">학원플러스 기본 요금</h2>
          <p className={styles.price}>월 {formatKoreanPrice(POST_AUGUST_MONTHLY_TOTAL_AMOUNT)}</p>
          <p className={styles.priceNote}>부가세 포함 결제금액</p>
          <dl className={styles.breakdown}>
            <div><dt>월 이용료</dt><dd>{formatKoreanPrice(POST_AUGUST_MONTHLY_SUPPLY_AMOUNT)}</dd></div>
            <div><dt>부가세 {MONTHLY_VAT_RATE_PERCENT}%</dt><dd>{formatKoreanPrice(POST_AUGUST_MONTHLY_TAX_AMOUNT)}</dd></div>
          </dl>
          <dl className={styles.included}>
            <div><dt>수강생·계정</dt><dd>인원에 따른 추가 요금 없음</dd></div>
            <div><dt>저장공간</dt><dd>200GB 포함</dd></div>
            <div><dt>기능</dt><dd>현재 제공 중인 기능 모두 포함</dd></div>
          </dl>
          <details className={styles.disclosure}><summary>포함된 기능 보기</summary><ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul><Link to="/promo/features">전체 기능 설명 보기</Link></details>
          <Link className={styles.primaryLink} to="/promo/demo">시연 신청</Link>
        </article>
        <aside className={styles.additional} id="additional-cost" aria-labelledby="additional-cost-title">
          <h2 id="additional-cost-title">별도로 협의하는 항목</h2>
          <p>아래 항목은 월 이용료와 별도로 범위와 비용을 확인합니다.</p>
          <dl className={styles.costItems}>
            <div><dt>알림톡 발송비</dt><dd>필요한 발송량을 확인합니다.</dd></div>
            <div><dt>추가 저장공간</dt><dd>기본 200GB를 넘는 용량은 별도 협의합니다.</dd></div>
            <div><dt>대량 데이터 이전</dt><dd>자료의 분량·형식과 이전 일정을 확인합니다.</dd></div>
            <div><dt>맞춤 개발</dt><dd>추가로 필요한 기능과 작업 범위를 협의합니다.</dd></div>
          </dl>
          <Link to="/promo/contact">필요한 범위 문의하기</Link>
        </aside>
      </div>
      <section className={styles.section} aria-labelledby="pricing-start-title">
        <h2 id="pricing-start-title">이용을 시작할 때</h2>
        <p>{START_GUIDANCE_NOTICE}</p>
        <p>기존 명부나 영상이 있다면 자료 형식과 이전 분량을 함께 알려주세요.</p>
        <Link to="/promo/guide">전체 사용 가이드 보기</Link>
      </section>
      <section className={styles.section} aria-labelledby="payment-scope-title">
        <h2 id="payment-scope-title">원비·교재비 온라인 결제는 도입 예정입니다</h2>
        <p>{PLANNED_PAYMENT_NOTICE}</p>
        <p>학원플러스 이용료 결제 및 현재 제공하는 수납 기록 관리와 별개입니다.</p>
      </section>
      <details ref={legacyRef} id="existing-contract" className={styles.disclosure}>
        <summary>2026년 8월 기존 가입 조건</summary>
        <div className={styles.legacy}>
          <h2>{AUGUST_PROMOTION_LABEL}</h2>
          <p>8월 가입 요금은 서비스를 이용하는 동안 계속 적용됩니다.</p>
          <dl className={styles.breakdown}>
            <div><dt>월 이용료</dt><dd>{formatKoreanPrice(AUGUST_MONTHLY_SUPPLY_AMOUNT)}</dd></div>
            <div><dt>고정 부가세</dt><dd>{formatKoreanPrice(AUGUST_MONTHLY_TAX_AMOUNT)}</dd></div>
            <div><dt>결제금액</dt><dd>{formatKoreanPrice(AUGUST_MONTHLY_TOTAL_AMOUNT)}</dd></div>
          </dl>
          <p>{AUGUST_PRICE_GUARANTEE}</p>
        </div>
      </details>
      <p className={styles.more}><Link to="/promo/faq#monthly-price">요금과 이용에 관한 자주 묻는 질문</Link></p>
    </div>
    <CtaSection title="이용 문의" subtitle="필요한 기능, 자료 이전 범위와 시작 일정을 안내합니다." />
  </>;
}
