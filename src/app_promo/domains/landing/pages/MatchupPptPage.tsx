import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  Check,
  Download,
  FileImage,
  FolderOpen,
  MousePointer2,
  Presentation,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import styles from "./MatchupPptPage.module.css";

type GuideStep = {
  number: string;
  label: string;
  icon: typeof Camera;
  title: string;
  body: string;
  points: string[];
  image: string;
  imageWidth: number;
  imageHeight: number;
  alt: string;
  caption: string;
  focus?: "ppt-result";
};

const GUIDE_STEPS: GuideStep[] = [
  {
    number: "01",
    label: "EXAM",
    icon: Camera,
    title: "실제 출제 문제를 등록합니다",
    body: "학교 시험이 끝난 뒤 실제 출제 문제를 이미지나 PDF로 올립니다. 학교·학기·시험별로 정리해 적중 근거의 기준으로 씁니다.",
    points: [
      "실제 시험 이미지·PDF 등록",
      "학교·학기·시험별 분류",
      "출제 문항을 원문 그대로 확인",
    ],
    image: "/promo/matchup-actual-vs-prepared-q1-20260726.jpg",
    imageWidth: 1263,
    imageHeight: 893,
    alt: "2026 숙명여고 실제 시험 문제와 시험 전에 다룬 학원 자료를 나란히 비교한 적중 보고서",
    caption: "공개 적중 보고서 · 2026 숙명여고 중간",
  },
  {
    number: "02",
    label: "EVIDENCE",
    icon: ScanSearch,
    title: "사전에 다룬 자료를 나란히 확인합니다",
    body: "우리 학원 자료에서 유사 문제 후보를 찾고 실제 출제 문항과 비교합니다. 선생님이 최종 선택한 자료가 적중 보고서의 근거가 됩니다.",
    points: [
      "실제 시험과 사전 대비 자료 비교",
      "유사도·출처는 확인 순서에만 활용",
      "선생님이 적중 근거를 최종 확정",
    ],
    image: "/promo/matchup-actual-vs-prepared-q2-20260726.jpg",
    imageWidth: 1263,
    imageHeight: 893,
    alt: "2026 숙명여고 실제 시험 문제와 시험 전에 다룬 학원 자료를 비교한 두 번째 적중 사례",
    caption: "실제 시험 ↔ 큐레이션 자료 · 선생님 확정",
  },
  {
    number: "03",
    label: "SPLIT",
    icon: Presentation,
    title: "수업자료를 문제·개념 단위로 나눕니다",
    body: "PPT 생성기는 매치업과 별도로 사용합니다. 이미지나 PDF 자료를 문제 또는 개념 단위로 나누고 수업 순서대로 배치합니다.",
    points: [
      "이미지·PDF 수업자료 업로드",
      "문제·개념별 슬라이드 분할",
      "16:9·4:3 화면 비율 선택",
    ],
    image: "/promo/ppt-gaepo-setup-20260725.png",
    imageWidth: 1280,
    imageHeight: 720,
    alt: "개포고 문제 자료를 슬라이드 단위로 나누고 16대 9 비율을 설정하는 학원플러스 PPT 생성 화면",
    caption: "제품 실화면 · 문제 단위 2장 구성",
  },
  {
    number: "04",
    label: "PROJECT",
    icon: Download,
    title: "칠판에 맞게 반전해 PPT로 만듭니다",
    body: "흰 배경·검은 글씨를 검은 배경·흰 글씨로 바꿔 빔프로젝터에 맞춥니다. PPT를 내려받아 리모컨으로 넘기며 수업합니다.",
    points: [
      "흑백반전·그레이스케일 적용",
      "밝기·대비와 화면 비율 확인",
      "PPT 다운로드 후 리모컨 수업",
    ],
    image: "/promo/ppt-gaepo-ready-panel-20260726.png",
    imageWidth: 460,
    imageHeight: 720,
    alt: "개포고 문제 자료의 그레이스케일, 밝기와 대비를 조정하고 칠판용 PPT를 내려받는 학원플러스 화면",
    caption: "제품 실화면 · 반전 설정 · 미리보기 · PPT 다운로드",
    focus: "ppt-result",
  },
];

const CLASS_PREP_EXAMPLE = [
  {
    time: "시험 후",
    title: "적중 근거 정리",
    body: "실제 출제 문제와 시험 전에 다룬 자료를 나란히 남깁니다.",
  },
  {
    time: "수업 전",
    title: "자료 분할·순서 정리",
    body: "문제와 개념 단위로 자료를 나누고 슬라이드 순서를 정합니다.",
  },
  {
    time: "강의실",
    title: "흑백반전 PPT 수업",
    body: "칠판에 화면을 띄우고 리모컨으로 슬라이드를 넘깁니다.",
  },
];

function ProductBar({ label }: { label: string }) {
  return (
    <div className={styles.productBar}>
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>{label}</strong>
      <em>hakwonplus</em>
    </div>
  );
}

export default function MatchupPptPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="matchup-ppt-page-title">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Sparkles size={16} />
              적중 근거 · 칠판용 PPT
            </span>
            <h1 id="matchup-ppt-page-title">
              적중은 근거로,
              <br />
              <em>수업자료는 칠판용으로</em>
            </h1>
            <p>
              매치업은 실제 시험과 우리 학원 사전 대비 자료를 비교합니다. PPT 생성기는 자료를
              문제·개념 단위로 나누고 흑백반전해 수업 준비 시간을 줄입니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryButton}>
                내 자료로 데모 요청
                <MousePointer2 size={18} />
              </Link>
              <PhoneInquiryLink className={styles.secondaryButton}>
                전화로 도입 문의
              </PhoneInquiryLink>
            </div>
            <ul className={styles.heroFacts}>
              <li>
                <Check size={15} />
                JPG·PNG·PDF
              </li>
              <li>
                <Check size={15} />
                시험 ↔ 사전 자료
              </li>
              <li>
                <Check size={15} />
                흑백반전 PPT
              </li>
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <figure className={styles.heroFrame}>
              <ProductBar label="실제 시험 ↔ 사전 대비 자료" />
              <img
                src="/promo/matchup-actual-vs-prepared-q1-20260726.jpg"
                alt="2026 숙명여고 실제 시험과 시험 전에 다룬 학원 자료를 비교한 적중 보고서"
                width={1263}
                height={893}
              />
            </figure>
            <div className={styles.heroTicket}>
              <span>REAL PRODUCT</span>
              <strong>제품 실화면</strong>
              <p>2026 숙명여고 공개 적중 사례</p>
            </div>
            <div className={styles.heroPptCard}>
              <Presentation size={23} />
              <span>별도 수업자료 기능</span>
              <strong>흑백반전 칠판 PPT</strong>
              <ArrowRight size={17} />
            </div>
          </div>
        </div>

        <a href="#guide" className={styles.scrollCue}>
          두 기능 따라보기
          <ArrowDown size={17} />
        </a>
      </section>

      <section className={styles.routeSection} aria-label="적중 매치업과 칠판용 PPT 사용 순서">
        <div className={styles.sectionWrap}>
          <ol className={styles.routeList}>
            {[
              { icon: Camera, title: "실제 시험", desc: "출제 문항 등록" },
              { icon: ScanSearch, title: "적중 근거", desc: "사전 자료 비교" },
              { icon: Star, title: "자료 분할", desc: "문제·개념 단위" },
              { icon: Presentation, title: "칠판 PPT", desc: "흑백반전·리모컨" },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={22} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                  {index === 1 ? (
                    <span className={styles.routeDivider}>별도 기능</span>
                  ) : index < 3 ? (
                    <ArrowRight className={styles.routeArrow} size={17} aria-hidden="true" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="guide" className={styles.guideSection} aria-labelledby="guide-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>FEATURE GUIDE</span>
            <h2 id="guide-title">두 기능은 목적이 다릅니다</h2>
            <p>
              매치업은 적중 근거를 남기고, PPT 생성기는 칠판 수업자료를 만듭니다.
              공개 적중 보고서와 실제 PPT 생성 화면을 확인해 구성했습니다.
            </p>
          </header>

          <div className={styles.guideStack}>
            {GUIDE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className={styles.guideCard} data-side={index % 2 === 0 ? "left" : "right"}>
                  <div className={styles.guideCopy}>
                    <div className={styles.guideIndex}>
                      <span>{step.number}</span>
                      <em>{step.label}</em>
                      <Icon size={22} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <ul>
                      {step.points.map((point) => (
                        <li key={point}>
                          <Check size={16} />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <figure className={styles.guideVisual} data-focus={step.focus}>
                    <ProductBar label={`${step.number} · ${step.label}`} />
                    <img
                      src={step.image}
                      alt={step.alt}
                      width={step.imageWidth}
                      height={step.imageHeight}
                      loading="lazy"
                    />
                    <figcaption>{step.caption}</figcaption>
                  </figure>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.guardrailSection} aria-labelledby="guardrail-title">
        <div className={styles.sectionWrap}>
          <div className={styles.guardrailCard}>
            <div className={styles.guardrailIcon}>
              <ShieldCheck size={31} />
            </div>
            <div>
              <span>MATCH SCORE, NOT AN ANSWER</span>
              <h2 id="guardrail-title">유사도는 후보를 보는 순서입니다</h2>
            </div>
            <p>
              화면의 85%·86%는 확인 순서를 돕는 값입니다. 실제 시험과 사전 대비 자료가
              같은 유형인지, 적중 근거로 쓸지는 선생님이 직접 결정합니다.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.exampleSection} aria-labelledby="class-example-title">
        <div className={styles.sectionWrap}>
          <div className={styles.exampleHead}>
            <span>DAECHI CLASS PREP</span>
            <h2 id="class-example-title">대치 수업에서는 이렇게 씁니다</h2>
            <p>시험 후에는 적중 근거를 남기고, 수업 전에는 칠판용 PPT를 따로 준비합니다.</p>
          </div>
          <div className={styles.exampleGrid}>
            {CLASS_PREP_EXAMPLE.map((item, index) => (
              <article key={item.time}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <em>{item.time}</em>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.fileRibbon}>
            <FileImage size={22} />
            <div>
              <span>MATCHUP</span>
              <strong>실제 시험 ↔ 사전 자료</strong>
            </div>
            <span className={styles.fileRibbonDivider}>별도 기능</span>
            <FolderOpen size={22} />
            <div>
              <span>PPT MAKER</span>
              <strong>문제·개념 단위 분할</strong>
            </div>
            <ArrowRight size={18} />
            <Presentation size={22} />
            <div>
              <span>CLASSROOM</span>
              <strong>흑백반전 칠판 PPT</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="matchup-final-title">
        <div className={styles.sectionWrap}>
          <div className={styles.finalCtaInner}>
            <span>YOUR MATERIAL, YOUR CLASS</span>
            <h2 id="matchup-final-title">선생님 자료로 두 기능을 따로 확인해 보세요</h2>
            <p>실제 시험과 사전 자료로 적중 근거를 확인하고, 수업자료로 칠판용 PPT를 만들어 보여드립니다.</p>
            <div>
              <Link to="/promo/demo" className={styles.primaryButton}>
                데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={styles.secondaryButton}>
                전체 기능 보기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
