import { Link } from "react-router";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  Check,
  Download,
  MousePointer2,
  Presentation,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CONSULT_PHONE_DISPLAY } from "../business";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import MatchupPptFileRibbon from "../components/MatchupPptFileRibbon";
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
    label: "실제 시험",
    icon: Camera,
    title: "시험지와 사전 자료를 문항별로 나눕니다",
    body: "학교 시험지와 시험 전에 다룬 학원 자료를 이미지나 PDF로 올립니다. 문항 자동 분리 결과를 확인하고 필요하면 직접 보정합니다.",
    points: [
      "실제 시험지·사전 대비 자료 등록",
      "문항 자동 분리·직접 보정",
      "학교·학기·시험별 분류",
    ],
    image: "/promo/matchup-gaepo-results-20260725.png",
    imageWidth: 1280,
    imageHeight: 720,
    alt: "실제 시험지와 사전 대비 자료를 문항별로 나눈 매치업 실제 화면",
    caption: "실제 화면 · 시험지와 사전 자료 문항 분리",
  },
  {
    number: "02",
    label: "자료 비교",
    icon: ScanSearch,
    title: "유사 후보를 보고 선생님이 확정합니다",
    body: "실제 출제 문항마다 학원 자료의 유사 후보를 확인합니다. 후보 점수는 확인 순서에만 쓰며, 선생님이 직접 비교해 선택한 자료가 적중 보고서의 근거가 됩니다.",
    points: [
      "문항별 유사 후보 제공",
      "실제 시험과 사전 대비 자료 나란히 비교",
      "선생님이 적중 근거 최종 확정",
    ],
    image: "/promo/matchup-gaepo-candidates-20260725.png",
    imageWidth: 1280,
    imageHeight: 720,
    alt: "실제 시험 문항마다 사전 대비 자료의 유사 후보를 보여주는 매치업 실제 화면",
    caption: "실제 화면 · 문항별 유사 후보 · 선생님 확인",
  },
  {
    number: "01",
    label: "자료 분할",
    icon: Presentation,
    title: "PDF 문항을 나누고 준비한 이미지를 배치합니다",
    body: "PDF는 문항을 자동으로 나누고, 문제·개념별로 준비한 이미지는 한 장씩 슬라이드로 배치해 수업 순서를 정합니다.",
    points: [
      "이미지·PDF 수업자료 업로드",
      "PDF 문항 자동 분리·이미지별 슬라이드",
      "16:9·4:3 화면 비율 선택",
    ],
    image: "/promo/ppt-gaepo-setup-20260725.png",
    imageWidth: 1280,
    imageHeight: 720,
    alt: "개포고 문제 자료를 슬라이드 단위로 나누고 16대 9 비율을 설정하는 학원플러스 PPT 생성 화면",
    caption: "실제 화면 · 문제 단위 2장 구성",
  },
  {
    number: "02",
    label: "PPT 생성",
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
    caption: "실제 화면 · 반전 설정 · 미리보기 · PPT 다운로드",
    focus: "ppt-result",
  },
];

const TOOL_GUIDES = [
  {
    id: "matchup",
    timing: "시험 후",
    title: "매치업",
    body: "학교 시험지와 우리 학원 사전 자료를 문항 단위로 비교해 유사 출제 근거를 남깁니다.",
    steps: GUIDE_STEPS.slice(0, 2),
  },
  {
    id: "ppt",
    timing: "수업 전",
    title: "칠판용 PPT 제작",
    body: "PDF와 이미지를 칠판 화면에 맞는 슬라이드로 구성해, 선생님의 반복 편집 시간을 줄입니다.",
    steps: GUIDE_STEPS.slice(2),
  },
] as const;

const TOOL_ROUTES = [
  {
    id: "matchup",
    icon: ScanSearch,
    timing: "시험 후",
    title: "매치업",
    body: "학교 시험지와 우리 학원 사전 자료의 유사 문항을 확인합니다.",
    steps: ["문항 자동 분리", "유사 후보 제공", "선생님 확정"],
  },
  {
    id: "ppt",
    icon: Presentation,
    timing: "수업 전",
    title: "칠판용 PPT 제작",
    body: "수업자료를 칠판에 띄울 PPT로 준비합니다.",
    steps: ["PDF·이미지 등록", "반전·화면비율 확인", "PPT 다운로드"],
  },
] as const;

const CLASS_PREP_EXAMPLE = [
  {
    time: "시험 후",
    title: "적중 근거 정리",
    body: "실제 출제 문제와 시험 전에 다룬 자료를 나란히 남깁니다.",
  },
  {
    time: "수업 전",
    title: "자료 분할·순서 정리",
    body: "PDF 문항을 자동으로 나누거나 준비한 이미지를 한 장씩 배치해 슬라이드 순서를 정합니다.",
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
      <em>학원플러스</em>
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
              실제 시험과 사전 자료를 비교하고,
              <br />
              <em>수업자료는 칠판용 PPT로 준비합니다</em>
            </h1>
            <p>
              매치업은 학교 시험지와 우리 학원 사전 자료를 문항별로 비교해 유사 출제 근거를 정리합니다.
              칠판용 PPT 도구는 PDF·이미지를 슬라이드로 구성하고 흑백반전합니다.
            </p>
            <div className={styles.heroToolGrid} aria-label="두 가지 핵심 자료 도구">
              <div data-tool="matchup">
                <span>시험 후</span>
                <strong>매치업</strong>
                <p>문항 자동 분리 · 유사 후보 · 선생님 확정</p>
              </div>
              <div data-tool="ppt">
                <span>수업 전</span>
                <strong>칠판용 PPT 제작</strong>
                <p>슬라이드 구성 · 흑백반전 · PPT 다운로드</p>
              </div>
            </div>
            <div className={styles.heroActions}>
              <Link to="/promo/demo?interest=matchup-ppt" className={styles.primaryButton}>
                내 학원 화면 요청
                <MousePointer2 size={18} />
              </Link>
              <PhoneInquiryLink className={styles.secondaryButton}>
                전화 상담 {CONSULT_PHONE_DISPLAY}
              </PhoneInquiryLink>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <figure className={styles.heroFrame}>
              <ProductBar label="매치업 · 문항별 유사 후보" />
              <PromoEvidenceImage
                src="/promo/matchup-gaepo-candidates-20260725.png"
                alt="실제 시험 문항과 학원 사전 자료의 유사 후보를 보여주는 매치업 실제 화면"
                width={1280}
                height={720}
              />
            </figure>
            <div className={styles.heroTicket}>
              <span>실제 사용 화면</span>
              <strong>매치업</strong>
              <p>문항 자동 분리 · 유사 후보</p>
            </div>
            <div className={styles.heroPptCard}>
              <Presentation size={23} />
              <span>수업자료 준비</span>
              <strong>흑백반전 칠판 PPT</strong>
              <ArrowRight size={17} />
            </div>
          </div>
        </div>

        <a href="#guide" className={styles.scrollCue}>
          사용 과정 보기
          <ArrowDown size={17} />
        </a>
      </section>

      <section className={styles.routeSection} aria-label="매치업과 칠판용 PPT 제작 개요">
        <div className={styles.sectionWrap}>
          <div className={styles.routeTools}>
            {TOOL_ROUTES.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.id} data-tool={tool.id}>
                  <header>
                    <Icon size={24} />
                    <span>{tool.timing}</span>
                  </header>
                  <div>
                    <h2>{tool.title}</h2>
                    <p>{tool.body}</p>
                  </div>
                  <ol>
                    {tool.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="guide" className={styles.guideSection} aria-labelledby="guide-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>기능별 사용 방법</span>
            <h2 id="guide-title">매치업과 칠판용 PPT 사용 과정</h2>
            <p>
              시험 후에는 매치업으로 실제 시험과 사전 자료를 비교합니다. 수업 전에는
              PDF와 이미지를 칠판용 PPT로 준비합니다.
            </p>
          </header>

          <div className={styles.toolGuideGroups}>
            {TOOL_GUIDES.map((guide) => (
              <section key={guide.id} className={styles.toolGuideGroup} data-tool={guide.id}>
                <header>
                  <span>{guide.timing}</span>
                  <h3>{guide.title}</h3>
                  <p>{guide.body}</p>
                </header>
                <div className={styles.guideStack}>
                  {guide.steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <article key={`${guide.id}-${step.number}`} className={styles.guideCard} data-side={index % 2 === 0 ? "left" : "right"}>
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
                          <ProductBar label={`${guide.title} ${step.number} · ${step.label}`} />
                          <PromoEvidenceImage
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
              </section>
            ))}
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
              <span>유사도 확인 기준</span>
              <h2 id="guardrail-title">유사도는 후보를 보는 순서입니다</h2>
            </div>
            <p>
              화면에 표시된 유사도는 비교할 후보의 순서를 정하는 참고값입니다. 적중 성과나
              출제 예측률을 뜻하지 않으며, 유사 문항 여부는 선생님이 직접 확인합니다.
              예시 자료의 학교·출제기관과 학원플러스의 제휴나 공식 인증을 의미하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.exampleSection} aria-labelledby="class-example-title">
        <div className={styles.sectionWrap}>
          <div className={styles.exampleHead}>
            <span>수업 전후 활용 예시</span>
            <h2 id="class-example-title">시험이 끝난 뒤부터 다음 수업까지 활용합니다</h2>
            <p>시험 후에는 적중 근거를 남기고, 다음 수업 전에는 칠판용 PPT를 준비합니다.</p>
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
          <MatchupPptFileRibbon />
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="matchup-final-title">
        <div className={styles.sectionWrap}>
          <div className={styles.finalCtaInner}>
            <span>자료 기반 데모</span>
            <h2 id="matchup-final-title">선생님의 시험지와 수업자료로 확인할 수 있습니다</h2>
            <p>실제 시험과 사전 자료로 적중 근거를 확인하고, 수업자료로 칠판용 PPT를 만들어 보여드립니다.</p>
            <div>
              <Link to="/promo/demo?interest=matchup-ppt" className={styles.primaryButton}>
                데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={styles.secondaryButton}>
                다른 기능 보기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
