import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import CtaSection from "../components/CtaSection";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./PromoPages.module.css";

const TIERS = [
  {
    level: "자동채점",
    title: "정답이 명확한 문항",
    body: "등록한 정답과 제출 답안을 비교해 지원되는 문항을 자동으로 채점합니다.",
    items: ["객관식·OX형", "일부 수학 단답형(0~999 정수)", "복수 객관 정답", "문항별 배점·총점 계산"],
  },
  {
    level: "직접 채점",
    title: "서술형 문항",
    body: "서술형 답안은 선생님이 직접 확인하고 점수를 입력합니다.",
    items: ["서술형 답안 확인", "문항별 수기 점수", "선생님 최종 확정", "수정 이력 확인"],
  },
  {
    level: "성적 관리",
    title: "확정 점수와 후속 안내",
    body: "확정한 점수는 시험·수강생별 성적 화면에서 확인하고 후속 관리에 활용합니다.",
    items: ["시험별 점수 확인", "수강생별 결과 확인", "보강 대상 판단", "학부모 안내에 활용"],
  },
];

const WORKFLOW = [
  { title: "시험과 정답 등록", desc: "문항 유형, 정답과 배점을 등록합니다." },
  { title: "답안 제출·OMR 처리", desc: "학생 답안 또는 OMR 결과를 시험에 연결합니다." },
  { title: "정답이 명확한 문항 자동채점", desc: "객관식·OX형과 일부 수학 단답형(0~999 정수)을 등록한 정답으로 채점합니다." },
  { title: "서술형 확인·점수 확정", desc: "서술형은 선생님이 직접 확인하고 최종 점수를 확정합니다." },
];

export default function AiGradingPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroAi}`} aria-labelledby="ai-grading-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>시험 채점과 성적 관리</span>
            <h1 id="ai-grading-title">정답이 명확한 문항은 자동으로, 서술형은 선생님이 직접 채점합니다</h1>
            <p>
              객관식·OX형과 일부 수학 단답형(정답이 0~999 정수인 문항)은 자동채점을 지원합니다.
              서술형 답안은 선생님이 확인하고 점수를 확정합니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryCta}>
                시험·성적 화면 데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features#exam-score" className={styles.secondaryCta}>
                시험·성적 기능 보기
              </Link>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="시험 운영 화면 미리보기">
            <figure className={styles.heroScreen}>
              <PromoEvidenceImage
                src="/promo/admin-exams-authority-20260726.png"
                alt="예시 시험 세 개의 채점 방식과 대상 수강생을 확인하는 관리자 시험 화면"
                width={1440}
                height={900}
              />
              <figcaption className={styles.heroScreenCaption}>
                <strong>시험 운영</strong>
                <span>실제 화면 · 예시 시험 3개</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <strong>정답이 명확한 문항 자동채점</strong>
                <p>객관식·OX형과 일부 수학 단답형(0~999 정수)을 채점합니다.</p>
              </article>
              <article>
                <strong>서술형 직접 채점</strong>
                <p>서술형 답안과 점수는 선생님이 직접 확인합니다.</p>
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
            <h2 id="ai-definition-title">문항 유형에 따라 채점 방식을 구분합니다</h2>
            <p>
              자동채점이 지원되는 문항과 선생님이 직접 채점하는 문항을 나누어 관리합니다.
              현재 제공 범위는 아래와 같습니다.
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
              <h2 id="grading-workflow-title">자동채점과 직접 채점을 한 성적표에서 관리합니다</h2>
              <p>
                시험별 채점 결과를 확인하고 서술형 점수를 입력한 뒤,
                선생님이 확정한 결과를 성적 관리와 안내에 활용합니다.
              </p>
              <div className={styles.principleBox}>
                <strong>제공 범위</strong>
                <p>서술형 AI 점수 제안은 현재 제공하지 않으며, 선생님이 직접 채점합니다.</p>
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
              <PromoEvidenceImage
                src="/promo/admin-scores-authority-20260726.png"
                alt="예시 학생 세 명의 시험별 점수와 판정 결과를 확인하는 관리자 성적 화면"
                width={1440}
                height={900}
                loading="lazy"
              />
            </div>
            <div className={styles.proofText}>
              <span className={styles.proofBadge}>실제 화면 · 예시 자료</span>
              <h3 id="grading-proof-title">시험과 성적을 강의·차시별로 관리합니다</h3>
              <p>
                강의와 차시를 기준으로 시험, 제출과 성적을 확인합니다.
                확정된 결과는 보강 판단과 학부모 안내에 활용할 수 있습니다.
              </p>
              <ul>
                <li>
                  <FileCheck2 size={16} />
                  시험별 점수와 처리 상태 확인
                </li>
                <li>
                  <ScanSearch size={16} />
                  서술형 답안은 선생님이 직접 채점
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  확정 결과를 성적 관리와 안내에 활용
                </li>
              </ul>
              <Link to="/promo/features#communication" className={styles.textButton}>
                결과 안내 보기
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <CtaSection
        title="현재 사용하는 시험 방식에 맞춰 확인해 보세요"
        subtitle="문항 유형과 채점 방식을 확인하고 실제 적용 범위를 안내합니다."
      />
    </div>
  );
}
