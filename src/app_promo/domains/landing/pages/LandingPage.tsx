import { useEffect, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  FileText,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  MousePointer2,
  Pause,
  Play,
  PlayCircle,
  Presentation,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./LandingPage.module.css";

type HeroCategory = {
  id: string;
  label: string;
  navCopy: string;
  title: string;
  copy: string;
  image: string;
  alt: string;
  imageWidth: number;
  imageHeight: number;
  href: string;
  cta: string;
  icon: LucideIcon;
  tone: "video" | "alimtalk" | "tools" | "website";
  kind: "phone" | "desktop";
  highlights: string[];
};

const HERO_CATEGORIES: HeroCategory[] = [
  {
    id: "video",
    label: "영상 수업",
    navCopy: "학생앱 복습",
    title: "학생은 앱에서 보고, 선생님은 시청 상태를 확인합니다",
    copy: "강의별 영상, 이어보기, 배속과 댓글을 학생앱에서 이용합니다. 선생님은 미시청·시청중·완료 상태와 마지막 재생 위치를 확인합니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어와 댓글 실제 화면",
    imageWidth: 780,
    imageHeight: 1688,
    href: "/promo/video-platform",
    cta: "영상 기능 보기",
    icon: PlayCircle,
    tone: "video",
    kind: "phone",
    highlights: ["학생앱 안에서 재생", "이어보기·배속·댓글", "수강생별 시청 이력"],
  },
  {
    id: "alimtalk",
    label: "알림톡 안내",
    navCopy: "반복 연락 정리",
    title: "알림톡은 자동과 직접 발송 범위를 나눠 사용합니다",
    copy: "가입·비밀번호 안내는 처리와 함께 발송됩니다. 클리닉·답변 알림은 설정된 항목만 자동으로 보내고, 출결·성적·수업 결과는 학생별 최종 문구를 미리 본 뒤 직접 발송합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "학원플러스 관리자 알림톡 발송 설정 실제 화면",
    imageWidth: 1440,
    imageHeight: 820,
    href: "/promo/features#communication",
    cta: "알림톡 기능 보기",
    icon: BellRing,
    tone: "alimtalk",
    kind: "desktop",
    highlights: ["가입·비밀번호 안내 자동", "클리닉·답변 알림은 설정 후 자동", "학생별 미리보기 후 직접 발송"],
  },
  {
    id: "tools",
    label: "자료 제작",
    navCopy: "반복 작업 절감",
    title: "반복되는 수업자료 작업을 줄입니다",
    copy: "PDF 문항을 자동으로 나누거나 문제·개념별로 준비한 이미지를 수업 순서대로 배치해 흑백반전 칠판용 PPT로 만듭니다. 매치업에서는 실제 시험과 시험 전에 다룬 자료를 나란히 확인합니다.",
    image: "/promo/ppt-gaepo-setup-20260725.png",
    alt: "문제 자료를 나누고 흑백반전해 칠판용 PPT를 만드는 실제 화면",
    imageWidth: 1280,
    imageHeight: 720,
    href: "/promo/matchup-ppt",
    cta: "자료 제작 기능 보기",
    icon: Presentation,
    tone: "tools",
    kind: "desktop",
    highlights: ["PDF 문항 자동 분리", "흑백반전·PPT 내려받기", "실제 시험과 사전 자료 비교"],
  },
  {
    id: "website",
    label: "학원 홈페이지",
    navCopy: "우리 학원 소개",
    title: "우리 학원에 맞는 홈페이지를 함께 운영합니다",
    copy: "학원명, 수업 소개, 강사 소개, 후기와 상담 정보를 직접 정리해 공개합니다. 적중 보고서와 공개 게시글도 학원 홈페이지에서 보여줄 수 있습니다.",
    image: "/promo/landing-daechi-preview-20260527.png",
    alt: "학원 소개와 적중 보고서를 함께 보여주는 학원 홈페이지 예시",
    imageWidth: 1080,
    imageHeight: 956,
    href: "/promo/landing-samples",
    cta: "홈페이지 형식 보기",
    icon: Globe2,
    tone: "website",
    kind: "desktop",
    highlights: ["4가지 홈페이지 형식", "소개·후기·상담 정보 편집", "적중 보고서·공개 글 게시"],
  },
];

const BASIC_OPERATIONS = [
  {
    icon: UsersRound,
    title: "강의·수강생",
    copy: "강의와 차시, 담당 수강생과 수강 상태를 한곳에서 확인합니다.",
  },
  {
    icon: ClipboardCheck,
    title: "출결·시험·성적",
    copy: "출결부터 시험 결과와 피드백까지 수업 기록을 이어서 관리합니다.",
  },
  {
    icon: MessageSquareText,
    title: "과제·질문",
    copy: "미제출 과제와 답변을 기다리는 질문을 놓치지 않고 확인합니다.",
  },
  {
    icon: GraduationCap,
    title: "보강·클리닉",
    copy: "성적과 과제, 영상 기록을 보고 후속 관리가 필요한 학생을 정합니다.",
  },
];

const DETAILED_WORKFLOWS = [
  {
    id: "video",
    label: "영상 수업",
    icon: PlayCircle,
    tone: "video",
    href: "/promo/video-platform",
    cta: "영상 기능 자세히 보기",
    summary: "영상 등록부터 시청 확인까지 선생님과 학생에게 보이는 흐름이 다릅니다.",
    stages: [
      {
        mode: "선생님 준비",
        title: "차시별 영상 등록",
        copy: "복습 영상을 강의와 차시에 연결하고 공개할 수강생을 정합니다.",
      },
      {
        mode: "자동 기록",
        title: "재생 위치와 시청 상태",
        copy: "학생이 본 시간, 마지막 재생 위치와 미시청·시청중·완료 상태가 남습니다.",
      },
      {
        mode: "선생님 확인",
        title: "챙길 학생 선택",
        copy: "미시청 학생을 확인하고 필요한 경우 복습 안내 알림톡을 직접 보냅니다.",
      },
      {
        mode: "학생 화면",
        title: "앱에서 이어보기",
        copy: "학생은 학생전용앱에서 마지막 위치부터 이어 보고 댓글을 남깁니다.",
      },
    ],
  },
  {
    id: "alimtalk",
    label: "알림톡 안내",
    icon: BellRing,
    tone: "alimtalk",
    href: "/promo/features#alimtalk-guide",
    cta: "자동·직접 발송 범위 보기",
    summary: "모든 안내가 자동으로 나가는 것이 아닙니다. 업무 성격에 따라 발송 방법을 나눕니다.",
    stages: [
      {
        mode: "항상 자동",
        title: "가입·비밀번호 안내",
        copy: "학생·학부모 계정 안내와 비밀번호 변경 안내는 계정 처리와 함께 발송됩니다.",
      },
      {
        mode: "설정 후 자동",
        title: "클리닉·답변 알림",
        copy: "승인 양식과 학원 설정이 준비된 예약·변경·입실·답변 알림만 자동으로 보냅니다.",
      },
      {
        mode: "선생님 확인",
        title: "출결·성적·수업 결과",
        copy: "대상별 최종 문구와 제외 대상을 미리 본 뒤 직접 발송합니다.",
      },
      {
        mode: "받는 화면",
        title: "카카오톡 수신·발송 결과",
        copy: "학생·학부모는 카카오톡으로 받고, 선생님은 실제 성공·실패를 발송 내역에서 확인합니다.",
      },
    ],
  },
  {
    id: "tools",
    label: "자료 제작",
    icon: Presentation,
    tone: "tools",
    href: "/promo/matchup-ppt",
    cta: "자료 제작 과정 보기",
    summary: "기계가 나누는 단계와 선생님이 판단하는 단계를 분리해 반복 작업만 줄입니다.",
    stages: [
      {
        mode: "선생님 준비",
        title: "PDF·이미지 등록",
        copy: "PDF 또는 문제·개념별로 준비한 이미지를 올리고 수업 자료를 선택합니다.",
      },
      {
        mode: "자동 처리",
        title: "PDF 문항 분리",
        copy: "PDF 문항은 자동으로 나누고 준비한 이미지는 한 장씩 슬라이드로 배치합니다.",
      },
      {
        mode: "선생님 확인",
        title: "순서·반전·화면 비율",
        copy: "슬라이드 순서와 흑백반전, 밝기·대비, 16:9·4:3 비율을 확인합니다.",
      },
      {
        mode: "수업 결과",
        title: "PPT 내려받기",
        copy: "칠판에 띄울 PPT를 내려받아 리모컨으로 넘기며 수업합니다.",
      },
    ],
  },
  {
    id: "website",
    label: "학원 홈페이지",
    icon: Globe2,
    tone: "website",
    href: "/promo/landing-samples",
    cta: "홈페이지 운영 방식 보기",
    summary: "처음 제작해 드린 뒤 학원에서 바뀌는 내용을 직접 관리할 수 있습니다.",
    stages: [
      {
        mode: "처음 준비",
        title: "형식과 소개 내용 결정",
        copy: "네 가지 형식 중 학원에 맞는 구성을 고르고 수업·강사·상담 정보를 준비합니다.",
      },
      {
        mode: "학원에서 편집",
        title: "소개·후기·자주 묻는 질문",
        copy: "운영 중 바뀌는 소개와 상담 내용을 관리자 화면에서 직접 수정합니다.",
      },
      {
        mode: "공개 반영",
        title: "적중 보고서·게시글",
        copy: "공개로 정한 적중 보고서와 글을 학원 홈페이지에 게시합니다.",
      },
      {
        mode: "방문자 화면",
        title: "상담·로그인 연결",
        copy: "방문자는 학원 정보를 보고 상담하거나 학생·선생님 서비스로 이동합니다.",
      },
    ],
  },
] as const;

const OPERATING_FLOW = [
  {
    label: "수업 전",
    title: "자료와 차시 준비",
    copy: "강의와 자료를 등록하고, 필요할 때 칠판용 PPT와 매치업 도구를 사용합니다.",
  },
  {
    label: "수업 후",
    title: "영상으로 복습 연결",
    copy: "학생은 앱에서 영상을 이어 보고, 선생님은 시청 상태를 확인합니다.",
  },
  {
    label: "기록 확인",
    title: "출결·성적·후속 관리",
    copy: "수업 기록을 바탕으로 더 챙겨야 할 학생과 다음 조치를 정합니다.",
  },
  {
    label: "안내·홍보",
    title: "알림톡과 학원 홈페이지",
    copy: "필요한 내용을 알림톡으로 안내하고, 공개할 소식은 학원 홈페이지에 정리합니다.",
  },
];

const START_POINTS = [
  {
    icon: BookOpenCheck,
    title: "현재 관리 방식을 먼저 확인합니다",
    copy: "엑셀, 수기와 지금 쓰는 관리 도구를 확인하고 먼저 정리할 업무를 정합니다.",
  },
  {
    icon: LayoutDashboard,
    title: "필요한 화면부터 실제로 보여드립니다",
    copy: "영상, 알림톡, 학생 관리, 자료 제작과 홈페이지 중 필요한 기능을 실제 화면으로 확인합니다.",
  },
  {
    icon: ShieldCheck,
    title: "월 요금과 별도 비용을 안내합니다",
    copy: "평소 월 결제 금액은 198,000원입니다. 2026년 8월 가입 시 공급가 월 145,000원(부가세 별도), 실제 월 결제 159,000원이 계속 적용됩니다.",
  },
];

function ProductFrame({
  label,
  detail,
  image,
  alt,
  imageWidth,
  imageHeight,
}: {
  label: string;
  detail: string;
  image: string;
  alt: string;
  imageWidth: number;
  imageHeight: number;
}) {
  return (
    <figure className={styles.productFrame}>
      <div className={styles.productBar}>
        <span aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <PromoEvidenceImage
        src={image}
        alt={alt}
        width={imageWidth}
        height={imageHeight}
        loading="lazy"
      />
    </figure>
  );
}

function HeroCategoryNavigator() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const active = HERO_CATEGORIES[activeIndex];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (
      interactionPaused ||
      userPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_CATEGORIES.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [interactionPaused, userPaused]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % HERO_CATEGORIES.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + HERO_CATEGORIES.length) % HERO_CATEGORIES.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = HERO_CATEGORIES.length - 1;
    else return;

    event.preventDefault();
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => {
      document.getElementById(`promo-category-tab-${HERO_CATEGORIES[nextIndex].id}`)?.focus();
    });
  };

  return (
    <div
      className={styles.heroNavigator}
      data-tone={active.tone}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div className={styles.categoryToolbar}>
        <span>네 가지 핵심 영역</span>
        <button
          type="button"
          aria-pressed={userPaused}
          onClick={() => setUserPaused((current) => !current)}
        >
          {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {userPaused ? "자동 전환 켜기" : "자동 전환 멈춤"}
        </button>
      </div>
      <div className={styles.categoryTabs} role="tablist" aria-label="학원플러스 핵심 기능">
        {HERO_CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const selected = index === activeIndex;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              id={`promo-category-tab-${category.id}`}
              aria-selected={selected}
              aria-controls="promo-category-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon size={ICON.sm} aria-hidden="true" />
              <strong>{category.label}</strong>
              <small>{category.navCopy}</small>
              {selected && <i className={styles.categoryProgress} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <section
        id="promo-category-panel"
        role="tabpanel"
        aria-labelledby={`promo-category-tab-${active.id}`}
        className={styles.categoryPanel}
      >
        <div className={styles.categoryVisual} data-kind={active.kind}>
          <PromoEvidenceImage
            key={active.image}
            src={active.image}
            alt={active.alt}
            width={active.imageWidth}
            height={active.imageHeight}
            loading="eager"
          />
          <span>실제 화면 · 예시 자료</span>
        </div>
        <div className={styles.categoryCopy}>
          <span>
            <ActiveIcon size={ICON.sm} aria-hidden="true" />
            {active.label}
          </span>
          <h2>{active.title}</h2>
          <p>{active.copy}</p>
          <ul>
            {active.highlights.map((highlight) => (
              <li key={highlight}>
                <Check size={ICON.sm} aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
          <Link to={active.href}>
            {active.cta}
            <ArrowRight size={ICON.sm} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="promo-hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Sparkles size={ICON.sm} aria-hidden="true" />
            수업·학생·학부모·운영
          </span>
          <h1 id="promo-hero-title">
            <span>학원의 수업과 운영을</span>
            <strong>한 흐름으로 관리합니다.</strong>
          </h1>
          <p className={styles.heroLead}>
            강의와 학생 기록을 정리하고, 학생은 앱에서 복습 영상을 봅니다.
            선생님은 출결·성적·시청 상태를 확인해 알림톡으로 안내하고,
            반복되는 자료 작업과 학원 홈페이지 관리도 함께 처리합니다.
          </p>
          <div className={styles.heroActions}>
            <Link to="/promo/demo" className={styles.primaryButton}>
              <MousePointer2 size={ICON.md} aria-hidden="true" />
              내 학원 기준으로 확인
            </Link>
            <a href="#core-system" className={styles.secondaryButton}>
              전체 운영 보기
              <ArrowRight size={ICON.md} aria-hidden="true" />
            </a>
          </div>
          <p className={styles.callLine}>
            전화가 편하시면 <PhoneInquiryLink>전화 문의</PhoneInquiryLink>로 현재 관리 방식을 먼저 말씀해주셔도 됩니다.
          </p>
          <ul className={styles.heroFacts} aria-label="주요 안내">
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              강의·학생·출결·성적 관리
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              실제 사용 화면
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              한 가지 요금으로 안내된 기능
            </li>
          </ul>
        </div>

        <HeroCategoryNavigator />
      </div>
    </section>
  );
}

function FoundationSection() {
  return (
    <section id="core-system" className={styles.foundationSection} aria-labelledby="foundation-title">
      <div className={styles.sectionWrap}>
        <div className={styles.foundationIntro}>
          <header className={styles.sectionHead}>
            <span>학원 운영의 기본</span>
            <h2 id="foundation-title">프로그램의 중심은 매일 반복되는 학원 관리입니다</h2>
            <p>
              강의와 수강생을 기준으로 출결, 시험, 성적, 과제, 질문과 보강 기록을 이어서 봅니다.
              네 가지 핵심 기능도 이 운영 기록과 연결됩니다.
            </p>
          </header>
          <Link to="/promo/features#class-management" className={styles.textLink}>
            전체 기능 구조 보기
            <ArrowRight size={ICON.sm} aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.foundationLayout}>
          <ProductFrame
            label="학원 운영 대시보드"
            detail="강의 · 시험 · 제출 · 질문"
            image="/promo/admin-home.png"
            alt="강의, 시험, 제출과 질문 현황을 확인하는 학원플러스 대시보드 실제 화면"
            imageWidth={1440}
            imageHeight={820}
          />
          <div className={styles.foundationList}>
            {BASIC_OPERATIONS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
                  <Icon size={ICON.md} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StrengthSection() {
  return (
    <section className={styles.strengthSection} aria-labelledby="strength-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>기능별 업무 구분</span>
          <h2 id="strength-title">자동으로 처리되는 일과 선생님이 확인하는 일을 나눴습니다</h2>
          <p>
            자동이라는 말만 앞세우지 않습니다. 어떤 정보가 자동으로 남고,
            어디서 선생님이 판단하는지 실제 사용 순서대로 보여드립니다.
          </p>
        </header>

        <div className={styles.strengthGrid}>
          {DETAILED_WORKFLOWS.map((workflow, index) => {
            const Icon = workflow.icon;
            return (
              <article key={workflow.id} data-tone={workflow.tone}>
                <Link
                  to={workflow.href}
                  className={styles.strengthCardLink}
                  data-workflow-card={workflow.id}
                  aria-label={`${workflow.label} 상세 보기`}
                >
                  <div className={styles.strengthIndex}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Icon size={ICON.lg} aria-hidden="true" />
                  </div>
                  <h3>{workflow.label}</h3>
                  <p>{workflow.summary}</p>
                  <ol className={styles.responsibilityFlow}>
                    {workflow.stages.map((stage) => (
                      <li key={stage.title}>
                        <span>{stage.mode}</span>
                        <div>
                          <strong>{stage.title}</strong>
                          <p>{stage.copy}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <span className={styles.strengthCardAction}>
                    {workflow.cta}
                    <ArrowRight size={ICON.sm} aria-hidden="true" />
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className={styles.flowSection} aria-labelledby="flow-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>수업 전후의 흐름</span>
          <h2 id="flow-title">한 번 남긴 기록을 다음 업무에 이어서 사용합니다</h2>
          <p>기능을 많이 펼쳐놓기보다, 실제 선생님이 일하는 순서에 맞춰 연결했습니다.</p>
        </header>
        <ol className={styles.flowList}>
          {OPERATING_FLOW.map((item, index) => (
            <li key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StartSection() {
  return (
    <section className={styles.startSection} aria-labelledby="start-title">
      <div className={styles.sectionWrap}>
        <div className={styles.startLayout}>
          <header className={styles.sectionHead}>
            <span>사용 시작 안내</span>
            <h2 id="start-title">현재 방식에 맞춰 필요한 기능부터 시작합니다</h2>
            <p>모든 기능을 한 번에 바꾸기보다, 지금 가장 시간이 많이 드는 업무부터 확인합니다.</p>
            <Link to="/promo/pricing" className={styles.textLink}>
              요금과 별도 비용 확인
              <ArrowRight size={ICON.sm} aria-hidden="true" />
            </Link>
          </header>
          <ol className={styles.startList}>
            {START_POINTS.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={ICON.lg} aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.copy}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="final-cta-title">
      <div className={styles.finalCtaInner}>
        <span>
          <FileText size={ICON.md} aria-hidden="true" />
          현재 방식부터 확인합니다
        </span>
        <h2 id="final-cta-title">우리 학원에서 먼저 필요한 기능을 실제 화면으로 확인하세요</h2>
        <p>현재 수업과 관리 방식을 알려주시면 영상, 알림톡, 운영, 자료 제작과 홈페이지 화면을 준비해 보여드립니다.</p>
        <div className={styles.finalActions}>
          <Link to="/promo/demo" className={styles.primaryButton}>
            내 학원 기준으로 확인
            <ArrowRight size={ICON.md} aria-hidden="true" />
          </Link>
          <Link to="/promo/features" className={styles.secondaryButton}>
            기능별로 보기
          </Link>
        </div>
        <p className={styles.finalCall}>
          전화가 편하시면 <PhoneInquiryLink>전화 문의</PhoneInquiryLink>
        </p>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FoundationSection />
      <StrengthSection />
      <FlowSection />
      <StartSection />
      <FinalCta />
    </>
  );
}
