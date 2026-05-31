// PATH: src/app_promo/domains/landing/pages/LandingPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Eye,
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
  Smartphone,
  Zap,
} from "lucide-react";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import styles from "./LandingPage.module.css";

const HERO_SLIDES = [
  {
    id: "trust",
    eyebrow: "학부모 설명 줄이기",
    title: "수업 근거를 주간 리포트로 정리합니다",
    body: "출결, 시험, 영상, 보강 기록을 한 주 단위로 묶어 알림톡과 상담 자료로 바로 쓸 수 있게 합니다.",
    image: "/promo/admin-scores.png",
    tone: "학부모 리포트",
    stat: "출결·성적·영상·보강 요약",
    cta: "/promo/parent-trust",
  },
  {
    id: "exam",
    eyebrow: "시험 후 처리",
    title: "채점 뒤에 보강 대상까지 바로 봅니다",
    body: "응시 현황, 채점, 문항별 약점, 보강 후보를 한 화면에서 확인해 시험 뒤 후속 조치를 놓치지 않습니다.",
    image: "/promo/admin-exams.png",
    tone: "채점·피드백",
    stat: "문항 분석부터 보강 안내",
    cta: "/promo/ai-grading",
  },
  {
    id: "message",
    eyebrow: "반복 연락 줄이기",
    title: "출결과 수업 결과 알림을 따로 쓰지 않습니다",
    body: "입실·결석, 수업 결과, 영상 확인 안내를 승인 템플릿에 연결해 반복 연락을 줄입니다.",
    image: "/promo/admin-messages.png",
    tone: "알림톡",
    stat: "출결·성적·영상 안내",
    cta: "/promo/features",
  },
  {
    id: "video",
    eyebrow: "학생앱 복습",
    title: "학생은 앱에서 영상을 보고, 선생님은 이력을 확인합니다",
    body: "누가 어디까지 봤는지 남기고, 미시청 학생에게 필요한 안내를 이어갈 수 있습니다.",
    image: "/promo/admin-lectures.png",
    tone: "학생앱 영상",
    stat: "이어보기·시청 이력·댓글",
    cta: "/promo/video-platform",
  },
];

const OPERATING_TABS = [
  {
    id: "classes",
    label: "수업 준비",
    icon: BookOpen,
    title: "오늘 수업, 제출, 미처리를 한 번에 봅니다",
    body: "강의와 차시, 담당 수강생 상태를 같은 화면에서 확인해 수업 전후 확인 시간을 줄입니다.",
    points: ["강의/차시 구조", "수강생별 상태", "미처리 확인"],
    image: "/promo/admin-lectures.png",
    accent: "mint",
  },
  {
    id: "scores",
    label: "시험·성적",
    icon: ClipboardCheck,
    title: "시험 결과가 보강 판단으로 이어집니다",
    body: "시험 생성, 채점, 성적표, 보강 후보 확인을 하나의 흐름으로 이어 실무 시간을 줄입니다.",
    points: ["시험 운영", "성적 분석", "보강 연결"],
    image: "/promo/admin-scores.png",
    accent: "amber",
  },
  {
    id: "message",
    label: "안내·메시지",
    icon: MessageSquareText,
    title: "출결, 수업 결과, 영상 안내를 알림톡으로 보냅니다",
    body: "입실·결석, 성적 피드백, 영상 시청 안내를 승인 템플릿과 연결해 선생님의 반복 연락을 줄입니다.",
    points: ["입실·결석 알림", "수업결과 알림톡", "영상 시청 안내"],
    image: "/promo/admin-messages.png",
    accent: "rose",
  },
  {
    id: "landing",
    label: "수업 홍보",
    icon: Megaphone,
    title: "수업 소개와 성과 근거를 한 페이지에 둡니다",
    body: "학교별 내신 대비반, 수강 후기, 적중 리포트를 공개 페이지로 정리해 상담 전에 보여줄 자료를 만듭니다.",
    points: ["학교별 내신 대비", "수강 후기", "적중 리포트"],
    image: "/promo/landing-daechi-preview-20260527.png",
    accent: "blue",
  },
];

const VALUE_CARDS = [
  {
    icon: ShieldCheck,
    title: "같은 설명을 덜 반복합니다",
    body: "상담 때마다 다시 말하던 출결, 시험, 영상, 보강 내용을 주간 리포트와 알림톡으로 먼저 정리합니다.",
  },
  {
    icon: BarChart3,
    title: "쌓인 기록이 자료가 됩니다",
    body: "시험 결과와 수업 이력이 적중 리포트, 후기, 상담 자료로 남아 다음 모집에도 다시 쓸 수 있습니다.",
  },
  {
    icon: Layers3,
    title: "수업 소개가 방치되지 않습니다",
    body: "운영 화면에서 남긴 근거를 공개 페이지와 상담 자료로 연결해 오래된 안내문처럼 보이지 않게 합니다.",
  },
];

const TRUST_METRICS = [
  { label: "이번 주 출결", value: "97%", detail: "결석 2명 자동 알림" },
  { label: "시험 평균", value: "86점", detail: "취약 문항 3개 표시" },
  { label: "영상 완료", value: "92%", detail: "미시청 5명 재안내" },
  { label: "보강 대기", value: "8명", detail: "클리닉 후보 정리" },
];

const TRUST_STEPS = [
  { icon: ClipboardCheck, title: "수업 데이터", body: "출결·시험·영상·보강 이력이 수업 흐름에서 쌓입니다." },
  { icon: BarChart3, title: "주간 요약", body: "학부모가 궁금해하는 변화와 다음 조치를 짧게 정리합니다." },
  { icon: BellRing, title: "알림톡 발송", body: "수업결과, 영상 확인, 보강 안내를 같은 근거로 보냅니다." },
  { icon: Megaphone, title: "상담 자료", body: "적중 리포트와 학교별 내신반 소개에 같은 근거를 다시 씁니다." },
];

const WORKFLOW = [
  { icon: GraduationCap, title: "수업", body: "강의와 수강생 상태 확인" },
  { icon: FileText, title: "평가", body: "시험·과제 생성과 응시" },
  { icon: BarChart3, title: "분석", body: "성적표와 문항별 분석" },
  { icon: CheckCircle2, title: "보강", body: "보강 대상자 판단" },
  { icon: MessageSquareText, title: "안내", body: "수업결과 알림톡 발송" },
];

const STUDENT_APP_POINTS = [
  {
    icon: Smartphone,
    title: "학생앱 영상 복습",
    body: "수강생은 모바일 앱에서 강의 목록, 재생 목록, 이어보기까지 한 흐름으로 봅니다.",
  },
  {
    icon: Eye,
    title: "시청 이력으로 후속 지도",
    body: "선생님은 미시청·시청중·완료 상태와 마지막 재생 위치를 기준으로 피드백 대상을 찾습니다.",
  },
  {
    icon: BellRing,
    title: "알림톡 발송",
    body: "입실·결석, 수업결과, 영상 시청 안내를 승인 템플릿 기반 알림톡으로 보냅니다.",
  },
];

const SAMPLE_CARDS = [
  { title: "개인 강사형", body: "깔끔한 수업 소개", color: "blue" },
  { title: "브랜드형", body: "대표 수업과 후기 중심", color: "ink" },
  { title: "성적 관리형", body: "시험 결과와 리포트 중심", color: "mint" },
  { title: "모집 안내형", body: "기간 모집과 커리큘럼 중심", color: "rose" },
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
            <PhoneInquiryLink className={`${styles.button} ${styles.buttonPhone}`}>
              전화 문의
            </PhoneInquiryLink>
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
            <li>학부모 리포트</li>
            <li>적중 리포트</li>
            <li>수업·영상·보강 기록</li>
          </ul>
        </div>

        <aside className={styles.heroRail} aria-label="히어로 배너">
          <div className={styles.heroRailHead}>
            <span>화면 미리보기</span>
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

function ParentTrustSystem() {
  return (
    <section className={styles.trustSection} aria-labelledby="parent-trust-title">
      <div className={styles.sectionWrap}>
        <div className={styles.trustLayout}>
          <div className={styles.trustCopy}>
            <span>
              <ShieldCheck size={16} />
              학부모 설명 자료
            </span>
            <h2 id="parent-trust-title">학부모가 궁금한 건 수업 후 조치입니다</h2>
            <p>
              화려한 문구보다 출결, 시험, 영상, 보강 기록이 정리되어 있을 때 상담이 짧아집니다.
              학원플러스는 이미 남기는 운영 기록을 리포트, 알림톡, 공개 소개 자료로 다시 쓰게 합니다.
            </p>
            <div className={styles.trustActions}>
              <Link to="/promo/parent-trust" className={`${styles.button} ${styles.buttonDark}`}>
                학부모 리포트 보기
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/pricing" className={styles.trustTextLink}>
                패키지 요금 보기
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className={styles.trustBoard} aria-label="학부모 리포트 예시">
            <div className={styles.trustBoardHead}>
              <div>
                <span>주간 리포트</span>
                <strong>대치중2 내신반 학부모 리포트</strong>
              </div>
              <small>알림톡 발송 준비</small>
            </div>
            <div className={styles.trustMetricGrid}>
              {TRUST_METRICS.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.detail}</p>
                </article>
              ))}
            </div>
            <ol className={styles.trustTimeline}>
              {TRUST_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <Icon size={18} />
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
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
          <span>실제 업무 흐름</span>
          <h2 id="product-flow-title">수업 전후 업무를 같은 화면에서 이어갑니다</h2>
          <p>수업 준비부터 채점, 피드백, 안내까지 선생님이 실제로 처리하는 순서대로 묶었습니다.</p>
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

function StudentAppProof() {
  return (
    <section className={styles.studentProof} aria-labelledby="student-proof-title">
      <div className={styles.sectionWrap}>
        <div className={styles.studentProofGrid}>
          <div className={styles.studentProofCopy}>
            <span>학생앱과 알림톡</span>
            <h2 id="student-proof-title">학생은 앱에서 보고, 선생님은 이력과 알림톡으로 챙깁니다</h2>
            <p>
              영상 기능은 바로 체감되는 영역입니다. 수강생이 학생전용앱에서 바로 보고,
              선생님은 시청 상태를 확인해 수업결과·출결·영상 안내 알림톡까지 이어갈 수 있습니다.
            </p>
            <ul className={styles.studentProofList}>
              {STUDENT_APP_POINTS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title}>
                    <Icon size={20} />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={styles.studentProofActions}>
              <Link to="/promo/video-platform" className={`${styles.button} ${styles.buttonPrimary}`}>
                영상 기능 자세히 보기
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={`${styles.button} ${styles.buttonSecondary}`}>
                알림톡 기능 보기
                <Clock3 size={18} />
              </Link>
            </div>
          </div>

          <div className={styles.phoneWall} aria-label="학생전용앱 영상 화면 캡처">
            <figure className={`${styles.phoneFrame} ${styles.phoneFrameLead}`}>
              <img src="/promo/student-video-player.png" alt="학생전용앱 영상 플레이어와 댓글 화면" loading="lazy" />
              <figcaption>플레이어·댓글·이어보기</figcaption>
            </figure>
            <figure className={styles.phoneFrame}>
              <img src="/promo/student-video-app.png" alt="학생전용앱 영상 강의 홈 화면" loading="lazy" />
              <figcaption>학생앱 강의 홈</figcaption>
            </figure>
            <figure className={styles.phoneFrame}>
              <img src="/promo/student-video-list.png" alt="학생전용앱 영상 재생 목록 화면" loading="lazy" />
              <figcaption>재생 목록과 진도</figcaption>
            </figure>
          </div>
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
          <span>업무 순서</span>
          <h2 id="workflow-title">시험 하나가 끝난 뒤에도 선생님의 일은 계속 이어집니다</h2>
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
            <span>수업 소개 페이지</span>
            <h2 id="samples-title">수업 소개 페이지를 오래된 안내문으로 두지 않습니다</h2>
            <p>
              선생님의 수업 소개, 후기, 게시판, 적중 보고서를 수업 관리 흐름과 연결해
              홍보 페이지가 오래된 안내문처럼 방치되지 않게 합니다.
            </p>
            <Link to="/promo/landing-samples" className={`${styles.button} ${styles.buttonDark}`}>
              페이지 샘플 보기
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className={styles.samplesGrid} aria-label="페이지 템플릿">
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
          <h2 id="final-cta-title">선생님의 수업 흐름에 맞는 구성을 같이 잡아보세요</h2>
          <p>현재 쓰는 강의, 시험, 피드백 방식부터 듣고 가장 작은 시작 경로를 제안드립니다.</p>
          <div className={styles.finalCtaActions}>
            <PhoneInquiryLink className={`${styles.button} ${styles.buttonPhone}`}>
              전화 문의
            </PhoneInquiryLink>
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
      <ParentTrustSystem />
      <OperatingHub />
      <StudentAppProof />
      <WorkflowSection />
      <LandingSamples />
      <FinalCta />
    </>
  );
}
