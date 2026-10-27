import { Link } from "react-router";
import CtaSection from "../components/CtaSection";
import PromoQuestions from "../components/PromoQuestions";
import { PROMO_QUESTIONS } from "../promoQuestions";
import styles from "./PromoReading.module.css";

const GROUPS = [
  { id: "cost", title: "요금과 포함 범위" },
  { id: "start", title: "이용 시작과 자료 이전" },
  { id: "use", title: "기능과 사용 방법" },
] as const;

export default function FaqPage() {
  return <>
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>자주 묻는 질문</h1>
        <p>요금, 이용 준비와 기능의 지원 범위를 정리했습니다.<br />궁금한 질문을 펼치면 답변과 관련 화면을 함께 볼 수 있습니다.</p>
        <nav className={styles.topics} aria-label="질문 분류">{GROUPS.map(group => <a key={group.id} href={`#faq-${group.id}`}>{group.title}</a>)}</nav>
      </header>
      {GROUPS.map(group => <section key={group.id} id={`faq-${group.id}`} className={styles.questionGroup} aria-labelledby={`faq-${group.id}-title`}>
        <h2 id={`faq-${group.id}-title`}>{group.title}</h2>
        <PromoQuestions questions={PROMO_QUESTIONS.filter(item => item.group === group.id)} />
      </section>)}
      <section className={styles.next} aria-labelledby="faq-next-title">
        <h2 id="faq-next-title">사용 순서를 찾고 있나요?</h2>
        <p>버튼 위치와 처리 순서는 전체 사용 가이드에서 업무별로 검색할 수 있습니다.</p>
        <Link to="/promo/guide">전체 사용 가이드 보기</Link>
        <Link to="/promo/features/tour">화면으로 보는 기능 상세 가이드</Link>
      </section>
    </div>
    <CtaSection title="남은 질문을 알려주세요" subtitle="필요한 기능이나 이용 조건을 문의 폼에 남길 수 있습니다." secondaryPath="/promo/contact" secondaryLabel="문의하기" />
  </>;
}
