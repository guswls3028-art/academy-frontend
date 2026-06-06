import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CtaSection from "../components/CtaSection";
import styles from "./PromoPages.module.css";

const TIERS = [
  {
    level: "1단계",
    title: "즉시 자동 판정",
    body: "정답이 분명한 문항은 제출 후 자동 판정해 반복 채점 시간을 줄입니다.",
    items: ["객관식 자동채점", "OX형 자동채점", "단답형 키워드 일치", "문항별 배점·총점 계산"],
  },
  {
    level: "2단계",
    title: "수업 정책 반영",
    body: "수업에서 허용할 유사 정답, 부분 점수, 복수 정답을 미리 정해둡니다.",
    items: ["유사 정답 허용", "오탈자 허용 규칙", "복수 정답", "부분 점수 기준"],
  },
  {
    level: "3단계",
    title: "AI 보조 평가",
    body: "서술형은 AI가 초안을 제안하고, 선생님이 확인한 뒤 점수를 확정합니다.",
    items: ["서술형 초안 점수 제안", "핵심 키워드 포함 분석", "루브릭 기반 추천", "강사용 검수 화면"],
  },
];

const WORKFLOW = [
  { title: "문항별 채점 방식 설정", desc: "시험을 만들 때 자동 채점, 키워드, 검수 필요 여부를 문항별로 정합니다." },
  { title: "제출 후 자동채점 실행", desc: "분명한 문항은 자동으로 처리하고 애매한 문항은 검수 대상으로 남깁니다." },
  { title: "이의 가능 문항 검토", desc: "유사 정답, 미응답, 부분 점수 후보를 선생님이 확인합니다." },
  { title: "선생님 확정 후 성적 반영", desc: "최종 점수는 성적표와 수업 결과 안내에 반영됩니다." },
];

export default function AiGradingPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroAi}`} aria-labelledby="ai-grading-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>채점 보조 원칙</span>
            <h1 id="ai-grading-title">자동채점은 명확하게, 최종 판단은 선생님이 합니다</h1>
            <p>
              중요한 건 “AI가 다 해준다”는 말이 아닙니다. 어떤 문항은 자동 판정되고
              어떤 문항은 선생님 확인이 필요한지 분명히 보여야 합니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryCta}>
                채점 화면 데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features#exam-score" className={styles.secondaryCta}>
                시험·성적 기능 보기
              </Link>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="AI 채점 화면 미리보기">
            <figure className={styles.heroScreen}>
              <img src="/promo/admin-exams.png" alt="관리자 시험 운영 화면" />
              <figcaption className={styles.heroScreenCaption}>
                <strong>시험 운영</strong>
                <span>문항 · 채점 · 검수</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <strong>명확한 문항 자동화</strong>
                <p>객관식, OX형, 단답형은 반복 채점 시간을 줄입니다.</p>
              </article>
              <article>
                <strong>서술형은 검수 구조</strong>
                <p>AI 제안은 초안이고 최종 확정 권한은 선생님에게 있습니다.</p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="ai-definition-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <ShieldCheck size={16} />
              채점 범위
            </span>
            <h2 id="ai-definition-title">홍보 문구에서 가장 조심해야 할 지점부터 분리했습니다</h2>
            <p>
              AI 자동채점은 모든 답안을 무조건 확정한다는 뜻이 아닙니다. 정답 기준이 분명한 문항은 자동으로 채점하고,
              해석이 필요한 답안은 AI 제안 뒤에 선생님이 확인합니다.
            </p>
          </header>

          <div className={styles.rangeGrid}>
            {TIERS.map((tier) => (
              <article key={tier.level} className={styles.rangeCard}>
                <span className={styles.proofBadge}>{tier.level}</span>
                <h3>{tier.title}</h3>
                <p>{tier.body}</p>
                <ul>
                  {tier.items.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="grading-workflow-title">
        <div className={styles.sectionWrap}>
          <div className={styles.workflowLayout}>
            <div className={styles.workflowCopy}>
              <span className={styles.compactLabel}>
                <ClipboardCheck size={16} />
                검수 과정
              </span>
              <h2 id="grading-workflow-title">선생님 검수가 남아 있어야 현장에서 안심합니다</h2>
              <p>
                성적은 민감합니다. 자동채점 결과를 그대로 학부모에게 보내지 않고,
                선생님이 확인해 확정한 결과만 성적표와 안내에 반영합니다.
              </p>
              <div className={styles.principleBox}>
                <strong>채점 원칙</strong>
                <p>최종 점수는 선생님이 확정하고, 자동채점 결과는 확인할 수 있게 남깁니다.</p>
              </div>
            </div>

            <ol className={styles.processList}>
              {WORKFLOW.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.catalogSection} aria-labelledby="grading-proof-title">
        <div className={styles.sectionWrap}>
          <article className={`${styles.proofCard} ${styles.proofCardFeatured}`} id="exam-score">
            <div className={styles.proofVisual}>
              <img src="/promo/admin-scores.png" alt="관리자 성적 분석 화면" loading="lazy" />
            </div>
            <div className={styles.proofText}>
              <span className={styles.proofBadge}>
                <Sparkles size={15} />
                성적 반영
              </span>
              <h3 id="grading-proof-title">채점 결과는 성적 분석과 수업결과 안내로 이어집니다</h3>
              <p>
                선생님이 확인한 결과만 성적표, 문항 분석, 보강 판단, 학부모 안내에 반영됩니다.
                그래야 AI 기능을 현장에서 부담 없이 쓸 수 있습니다.
              </p>
              <ul>
                <li>
                  <FileCheck2 size={16} />
                  문항별 판정 결과와 총점을 한 화면에서 확인
                </li>
                <li>
                  <ScanSearch size={16} />
                  검수가 필요한 답안을 따로 골라 확인
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  확정 결과를 성적표와 알림톡 안내에 반영
                </li>
              </ul>
              <Link to="/promo/features#alimtalk" className={styles.textButton}>
                결과 안내 보기
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
