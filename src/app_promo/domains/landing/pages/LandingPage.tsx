// PATH: src/app_promo/domains/landing/pages/LandingPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers3,
  Megaphone,
  MessageSquareText,
  MousePointer2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";
import { CONSULT_PHONE_DISPLAY, CONSULT_PHONE_TEL } from "../business";
import styles from "./LandingPage.module.css";

const HERO_SLIDES = [
  {
    id: "control",
    eyebrow: "TEACHER WORKFLOW OS",
    title: "강사님의 수업·성적·안내를 한 화면에서 정리합니다",
    body: "수업 준비, 시험, 보강, 학부모 안내를 따로 관리하지 않고 하나의 흐름으로 연결합니다.",
    image: "/promo/admin-home.png",
    tone: "수업 허브",
    stat: "수업 이후 업무를 한 흐름으로",
    cta: "/promo/features",
  },
  {
    id: "exam",
    eyebrow: "TEST TO ACTION",
    title: "시험이 끝나면 피드백까지 바로 이어집니다",
    body: "응시 현황, 채점, 성적 분석, 보강 대상자 판단까지 강사님이 다음 행동을 바로 볼 수 있습니다.",
    image: "/promo/admin-exams.png",
    tone: "채점·피드백",
    stat: "문항 분석부터 보강 안내",
    cta: "/promo/ai-grading",
  },
  {
    id: "message",
    eyebrow: "PARENT TOUCHPOINT",
    title: "학부모 안내가 늦지 않게 이어집니다",
    body: "성적과 과제, 보강 결과를 상황별 메시지로 정리해 반복 안내를 줄입니다.",
    image: "/promo/admin-messages.png",
    tone: "메시지",
    stat: "상황별 안내 템플릿",
    cta: "/promo/features",
  },
  {
    id: "video",
    eyebrow: "LEARNING MEDIA",
    title: "영상 자료가 수업 흐름과 연결됩니다",
    body: "수업 영상, 이어보기, 시청 이력을 강의와 수강생 흐름 안에서 확인합니다.",
    image: "/promo/admin-lectures.png",
    tone: "영상 학습",
    stat: "강의별 콘텐츠 허브",
    cta: "/promo/video-platform",
  },
];

const OPERATING_TABS = [
  {
    id: "classes",
    label: "수업 준비",
    icon: BookOpen,
    title: "강의, 차시, 담당 수강생 현황을 한 번에 정리",
    body: "오늘 수업과 제출, 미처리 확인을 같은 화면에서 보며 수업 전후 시간을 줄입니다.",
    points: ["강의/차시 구조", "수강생별 상태", "미처리 확인"],
    image: "/promo/admin-lectures.png",
    accent: "mint",
  },
  {
    id: "scores",
    label: "시험·성적",
    icon: ClipboardCheck,
    title: "평가 결과가 후속 조치로 바로 이어집니다",
    body: "시험 생성, 채점, 성적표, 보강 대상자 판단을 하나의 흐름으로 이어 실무 시간을 줄입니다.",
    points: ["시험 운영", "성적 분석", "보강 연결"],
    image: "/promo/admin-scores.png",
    accent: "amber",
  },
  {
    id: "message",
    label: "안내·메시지",
    icon: MessageSquareText,
    title: "반복 안내를 줄이는 학부모 메시지",
    body: "성적, 출결, 과제, 보강 결과를 메시지 템플릿과 연결해 안내 누락을 줄입니다.",
    points: ["템플릿 발송", "연동 상태", "수강생/학부모 접점"],
    image: "/promo/admin-messages.png",
    accent: "rose",
  },
  {
    id: "landing",
    label: "수업 홍보",
    icon: Megaphone,
    title: "강사님의 수업 소개 페이지까지 바로 정리",
    body: "수업 소개, 후기, 공개 게시판, 적중 보고서를 같은 흐름 안에서 게시합니다.",
    points: ["수업 소개", "후기/게시판", "공개 보고서"],
    image: "/promo/screenshot-dashboard.png",
    accent: "blue",
  },
];

const VALUE_CARDS = [
  {
    icon: Layers3,
    title: "흐름 중심",
    body: "메뉴를 많이 늘리는 대신 수업 이후의 업무가 자연스럽게 다음 단계로 이어지게 설계했습니다.",
  },
  {
    icon: ShieldCheck,
    title: "팀 수업 확장",
    body: "개인 강사부터 여러 반을 맡는 팀까지 같은 기준으로 수업 자료와 권한을 정리합니다.",
  },
  {
    icon: UsersRound,
    title: "현장형 UX",
    body: "강사님이 매일 반복해서 쓰는 화면을 기준으로 클릭 수와 판단 비용을 줄입니다.",
  },
];

const WORKFLOW = [
  { icon: GraduationCap, title: "수업", body: "강의와 수강생 상태 확인" },
  { icon: FileText, title: "평가", body: "시험·과제 생성과 응시" },
  { icon: BarChart3, title: "분석", body: "성적표와 문항별 분석" },
  { icon: CheckCircle2, title: "보강", body: "보강 대상자 판단" },
  { icon: MessageSquareText, title: "안내", body: "수강생·학부모 메시지" },
];

const SAMPLE_CARDS = [
  { title: "Minimal Tutor", body: "깔끔한 개인 강사형", color: "blue" },
  { title: "Premium Dark", body: "프리미엄 수업 브랜드형", color: "ink" },
  { title: "Academic Trust", body: "성적·관리 신뢰형", color: "mint" },
  { title: "Program Promo", body: "프로그램 모집형", color: "rose" },
];

function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = HERO_SLIDES[active];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || mediaQuery.matches) return undefined;
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const move = (delta: number) => {
    setPaused(true);
    setActive((value) => (value + delta + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  return (
    <section className={styles.hero} aria-labelledby="promo-hero-title">
      <div className={styles.heroMedia} aria-hidden="true">
        {HERO_SLIDES.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.image}
            alt=""
            className={`${styles.heroImage} ${index === active ? styles.heroImageActive : ""}`}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className={styles.heroVeil} />
        <div className={styles.heroGrid} />
      </div>

      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>{current.eyebrow}</span>
          <h1 id="promo-hero-title" className={styles.heroTitle}>
            {current.title}
          </h1>
          <p className={styles.heroBody}>{current.body}</p>
          <div className={styles.heroActions}>
            <a href={CONSULT_PHONE_TEL} className={`${styles.button} ${styles.buttonPhone}`}>
              전화 상담 {CONSULT_PHONE_DISPLAY}
            </a>
            <Link to="/promo/demo" className={`${styles.button} ${styles.buttonPrimary}`}>
              <MousePointer2 size={18} />
              데모 요청
            </Link>
            <Link to={current.cta} className={`${styles.button} ${styles.buttonSecondary}`}>
              {current.tone} 보기
              <ArrowRight size={18} />
            </Link>
          </div>
          <ul className={styles.heroTags} aria-label="핵심 가치">
            <li>시험 이후 피드백</li>
            <li>수강생앱·학부모 안내</li>
            <li>수업 소개 페이지</li>
          </ul>
        </div>

        <aside className={styles.heroRail} aria-label="히어로 배너">
          <div className={styles.heroRailHead}>
            <span>LIVE VIEW</span>
            <strong>{String(active + 1).padStart(2, "0")}</strong>
          </div>
          <div className={styles.heroRailMeta}>
            <span>{current.tone}</span>
            <p>{current.stat}</p>
          </div>
          <div className={styles.heroControls}>
            <button type="button" onClick={() => move(-1)} aria-label="이전 배너">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "배너 재생" : "배너 일시정지"}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button type="button" onClick={() => move(1)} aria-label="다음 배너">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className={styles.heroTabs} role="tablist" aria-label="배너 선택">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={active === index}
                className={active === index ? styles.isActive : ""}
                onClick={() => {
                  setPaused(true);
                  setActive(index);
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{slide.tone}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ValueStrip() {
  return (
    <section className={styles.valueStrip} aria-label="학원플러스 핵심 가치">
      <div className={styles.sectionWrap}>
        <div className={styles.valueGrid}>
          {VALUE_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <article className={styles.valueCard} key={item.title}>
                <Icon size={24} />
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OperatingHub() {
  const [activeTab, setActiveTab] = useState(OPERATING_TABS[0].id);
  const active = useMemo(
    () => OPERATING_TABS.find((item) => item.id === activeTab) ?? OPERATING_TABS[0],
    [activeTab],
  );
  const ActiveIcon = active.icon;

  return (
    <section className={styles.operatingHub} id="product-flow" aria-labelledby="product-flow-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>PRODUCT FLOW</span>
          <h2 id="product-flow-title">강사님의 주요 업무 화면을 탭처럼 오가세요</h2>
          <p>수업 준비부터 채점, 피드백, 안내까지 실제 수업 순서대로 바로 이해되는 흐름입니다.</p>
        </header>

        <div className={styles.hubShell}>
          <nav className={styles.hubSidebar} aria-label="수업 관리 화면">
            {OPERATING_TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === active.id ? styles.isActive : ""}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <article className={styles.hubPanel} data-accent={active.accent}>
            <div className={styles.hubCopy}>
              <span className={styles.hubKicker}>
                <ActiveIcon size={16} />
                {active.label}
              </span>
              <h3>{active.title}</h3>
              <p>{active.body}</p>
              <ul>
                {active.points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={16} />
                    {point}
                  </li>
                ))}
              </ul>
              <Link to="/promo/features" className={styles.textLink}>
                기능 전체 보기
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className={styles.hubVisual}>
              <img src={active.image} alt={`${active.label} 화면 미리보기`} loading="lazy" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className={styles.workflowSection} aria-labelledby="workflow-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>OPERATING ROUTE</span>
          <h2 id="workflow-title">시험 하나가 끝난 뒤에도 강사님의 일은 계속 이어집니다</h2>
        </header>
        <ol className={styles.workflow}>
          {WORKFLOW.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <span className={styles.workflowNum}>{String(index + 1).padStart(2, "0")}</span>
                <Icon size={22} />
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function LandingSamples() {
  return (
    <section className={styles.samplesSection} aria-labelledby="samples-title">
      <div className={styles.sectionWrap}>
        <div className={styles.samplesLayout}>
          <div className={styles.samplesCopy}>
            <span>PUBLIC SITE</span>
            <h2 id="samples-title">수업 소개 페이지도 강의 자료처럼 관리합니다</h2>
            <p>
              강사님의 수업 소개, 후기, 게시판, 적중 보고서를 수업 관리 흐름과 연결해
              홍보 페이지가 오래된 안내문처럼 방치되지 않게 합니다.
            </p>
            <Link to="/promo/landing-samples" className={`${styles.button} ${styles.buttonDark}`}>
              랜딩 샘플 보기
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className={styles.samplesGrid} aria-label="랜딩 템플릿">
            {SAMPLE_CARDS.map((sample) => (
              <Link
                key={sample.title}
                to="/promo/landing-samples"
                className={styles.sampleCard}
                data-color={sample.color}
              >
                <span />
                <strong>{sample.title}</strong>
                <small>{sample.body}</small>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="final-cta-title">
      <div className={styles.sectionWrap}>
        <div className={styles.finalCtaInner}>
          <span>
            <Sparkles size={18} />
            수업 상담
          </span>
          <h2 id="final-cta-title">강사님의 수업 흐름에 맞는 구성을 같이 잡아보세요</h2>
          <p>현재 쓰는 강의, 시험, 피드백 방식부터 듣고 가장 작은 시작 경로를 제안드립니다.</p>
          <div className={styles.finalCtaActions}>
            <a href={CONSULT_PHONE_TEL} className={`${styles.button} ${styles.buttonPhone}`}>
              전화 상담 {CONSULT_PHONE_DISPLAY}
            </a>
            <Link to="/promo/demo" className={`${styles.button} ${styles.buttonPrimary}`}>
              데모 요청
              <Zap size={18} />
            </Link>
            <Link to="/promo/contact" className={`${styles.button} ${styles.buttonSecondary}`}>
              문의하기
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ValueStrip />
      <OperatingHub />
      <WorkflowSection />
      <LandingSamples />
      <FinalCta />
    </>
  );
}
