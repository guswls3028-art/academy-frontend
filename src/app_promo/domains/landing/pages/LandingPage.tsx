import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpenCheck,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MessageSquareText,
  MousePointer2,
  PlayCircle,
  Presentation,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./LandingPage.module.css";

const AUDIENCES = [
  {
    label: "개인 강사",
    copy: "시험지와 수업자료를 체계적으로 준비하고 싶은 선생님",
  },
  {
    label: "학원 원장",
    copy: "여러 반의 수업 기록과 학부모 안내를 함께 확인하고 싶은 원장님",
  },
  {
    label: "운영 실장",
    copy: "출결·성적·영상·보강 현황을 빠짐없이 확인해야 하는 운영 담당자",
  },
];

const VALUE_ITEMS = [
  {
    icon: Presentation,
    title: "적중 근거와 칠판용 PPT를 따로",
    copy: "실제 시험과 우리 학원 대비 자료를 비교해 적중 근거를 남기고, 수업자료는 문제·개념 단위로 나눠 PPT로 만듭니다.",
  },
  {
    icon: ClipboardCheck,
    title: "시험 뒤 챙길 학생을 한눈에",
    copy: "성적, 미제출, 영상 시청, 보강 기록을 따로 찾지 않고 필요한 학생부터 확인합니다.",
  },
  {
    icon: MessageSquareText,
    title: "학부모 안내는 기록을 보고",
    copy: "저장된 수업 결과를 확인하고, 선생님이 내용을 최종 검수한 뒤 승인된 알림톡으로 안내합니다.",
  },
];

const MATCHUP_STEPS = [
  {
    icon: Camera,
    title: "적중 매치업",
    copy: "실제 출제 문제와 시험 전에 다룬 학원 자료를 나란히 보고, 선생님이 유사 문항을 확인합니다.",
  },
  {
    icon: CheckCircle2,
    title: "칠판용 PPT",
    copy: "수업자료를 문제·개념 단위로 나누고 흑백반전한 뒤 PPT로 내려받습니다.",
  },
];

const OPERATIONS = [
  {
    id: "scores",
    icon: BarChart3,
    eyebrow: "시험·성적",
    title: "시험이 끝난 뒤, 다음 조치까지 이어집니다",
    copy: "점수와 미처리 상태를 한 화면에서 확인하고, 취약 문항과 보강이 필요한 학생을 선생님이 판단합니다.",
    bullets: ["수강생별 점수·미처리 확인", "문항별 결과와 취약 지점 확인", "피드백과 보강 기록 연결"],
    image: "/promo/admin-scores-authority-20260726.png",
    alt: "예시 학생 세 명의 시험별 점수와 판정 결과를 확인하는 학원플러스 성적 화면",
    imageWidth: 1440,
    imageHeight: 900,
    href: "/promo/ai-grading",
    cta: "채점·성적 화면 보기",
    kind: "desktop",
  },
  {
    id: "video",
    icon: PlayCircle,
    eyebrow: "학생앱 영상",
    title: "학생은 이어 보고, 선생님은 시청 상태를 봅니다",
    copy: "학생은 별도 링크를 찾지 않고 앱에서 복습 영상을 보고, 선생님은 마지막 위치와 완료 여부를 확인합니다.",
    bullets: ["강의별 영상 목록", "이어보기·배속·댓글", "미시청·시청중·완료 상태"],
    image: "/promo/student-video-player.png",
    alt: "학원플러스 학생앱 영상 플레이어 실제 화면",
    imageWidth: 780,
    imageHeight: 1688,
    href: "/promo/video-platform",
    cta: "학생앱 영상 보기",
    kind: "phone",
  },
  {
    id: "message",
    icon: BellRing,
    eyebrow: "학부모 알림톡",
    title: "보내기 전에 선생님이 내용을 확인합니다",
    copy: "가입·출결·시험·클리닉처럼 반복되는 안내는 승인된 양식을 사용하고, 선생님 메모는 발송 전에 최종 확인합니다.",
    bullets: ["승인된 공용 알림톡 양식", "자동·수동 발송 상태 구분", "발송 전 내용과 대상 확인"],
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "학원플러스 관리자 알림톡 실제 화면",
    imageWidth: 1440,
    imageHeight: 820,
    href: "/promo/features#communication",
    cta: "알림톡 운영 보기",
    kind: "desktop",
  },
];

const START_POINTS = [
  {
    icon: BookOpenCheck,
    title: "현재 관리 방식을 먼저 확인합니다",
    copy: "엑셀, 수기와 지금 쓰는 관리 도구를 확인하고 필요한 기능부터 시작합니다.",
  },
  {
    icon: FileText,
    title: "실제 자료로 화면을 보여드립니다",
    copy: "선생님의 시험지와 수업자료를 기준으로 적중 매치업과 칠판용 PPT 화면을 안내합니다.",
  },
  {
    icon: ShieldCheck,
    title: "월 요금과 별도 비용을 안내합니다",
    copy: "평소 월 요금은 198,000원입니다. 2026년 8월에 가입하면 이용하는 동안 월 159,000원이 계속 적용되며, 별도 비용도 함께 안내합니다.",
  },
];

function ProductFrame({
  label,
  detail,
  image,
  alt,
  imageWidth = 1280,
  imageHeight = 720,
  eager = false,
}: {
  label: string;
  detail: string;
  image: string;
  alt: string;
  imageWidth?: number;
  imageHeight?: number;
  eager?: boolean;
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
        loading={eager ? "eager" : "lazy"}
      />
    </figure>
  );
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="promo-hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Sparkles size={ICON.sm} aria-hidden="true" />
            수업자료와 학원 운영
          </span>
          <h1 id="promo-hero-title">
            <span>수업 준비부터 학원 운영까지,</span>
            <strong>한곳에서 편리하게 관리합니다.</strong>
          </h1>
          <p className={styles.heroLead}>
            실제 시험과 사전 대비 자료를 비교하고, 문제·개념 자료는 흑백반전한 칠판용 PPT로
            준비할 수 있습니다. 출결·성적·영상·알림톡도 같은 화면에서 관리합니다.
          </p>
          <div className={styles.heroActions}>
            <Link to="/promo/demo" className={styles.primaryButton}>
              <MousePointer2 size={ICON.md} aria-hidden="true" />
              내 자료로 데모 요청
            </Link>
            <a href="#real-screens" className={styles.secondaryButton}>
              실제 화면 보기
              <ArrowRight size={ICON.md} aria-hidden="true" />
            </a>
          </div>
          <p className={styles.callLine}>
            전화가 편하시면 <PhoneInquiryLink>전화 문의</PhoneInquiryLink>로 필요한 기능만 먼저 확인할 수 있습니다.
          </p>
          <ul className={styles.heroFacts} aria-label="주요 안내">
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              실제 사용 화면
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              선생님 최종 확인
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              한 가지 요금으로 안내된 기능
            </li>
          </ul>
        </div>

        <div className={styles.heroWorkbench} aria-label="적중 매치업과 칠판용 PPT 실제 사용 화면">
          <div className={styles.workbenchLabel}>
            <span>수업자료 기능</span>
            <strong>실제 시험과 사전 대비 자료 비교</strong>
          </div>
          <ProductFrame
            label="적중 매치업"
            detail="실제 시험 ↔ 사전 대비 자료"
            image="/promo/matchup-actual-vs-prepared-q1-20260726.jpg"
            alt="실제 시험 문제와 시험 전에 다룬 학원 자료를 나란히 비교한 적중 보고서 예시"
            imageWidth={1263}
            imageHeight={893}
            eager
          />
          <div className={styles.heroConnector} aria-hidden="true">
            <span>서로 다른 두 기능</span>
          </div>
          <div className={styles.pptPreview}>
            <ProductFrame
              label="칠판용 PPT"
              detail="문항 분할 · 흑백반전"
              image="/promo/ppt-gaepo-setup-20260725.png"
              alt="문제 자료를 나누고 흑백반전해 16대 9 칠판용 PPT로 구성하는 학원플러스 화면"
              eager
            />
          </div>
          <div className={styles.proofStamp}>
            <CheckCircle2 size={ICON.md} aria-hidden="true" />
            <span>
              <strong>실제 사용 화면</strong>
              제공 자료 일부 발췌 · 학교와의 제휴를 의미하지 않음
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function AudienceStrip() {
  return (
    <section className={styles.audienceSection} aria-labelledby="audience-title">
      <div className={styles.sectionWrap}>
        <header className={styles.audienceHead}>
          <span>누구에게 필요한가요?</span>
          <h2 id="audience-title">수업자료와 운영 기록을 체계적으로 관리하고 싶을 때</h2>
        </header>
        <div className={styles.audienceGrid}>
          {AUDIENCES.map((item) => (
            <article key={item.label}>
              <strong>{item.label}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValueSection() {
  return (
    <section className={styles.valueSection} aria-labelledby="value-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>업무 연결 방식</span>
          <h2 id="value-title">수업자료와 기록을 다음 업무에 이어서 사용합니다</h2>
          <p>한 번 등록한 자료와 기록을 수업 준비, 성적 관리, 학부모 안내에 활용할 수 있습니다.</p>
        </header>
        <div className={styles.valueGrid}>
          {VALUE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={ICON.lg} aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MatchupShowcase() {
  return (
    <section id="real-screens" className={styles.matchupSection} aria-labelledby="matchup-title">
      <div className={styles.sectionWrap}>
        <div className={styles.matchupIntro}>
          <header className={styles.sectionHead}>
            <span>수업자료 준비</span>
            <h2 id="matchup-title">유사 문항 확인과 칠판용 PPT 제작</h2>
            <p>
              매치업은 실제 시험 문제와 우리 학원이 사전에 다룬 자료를 비교합니다.
              PPT 생성기는 자료를 문제·개념 단위로 나누고 칠판에 맞게 반전합니다.
            </p>
          </header>
          <div className={styles.teacherNote}>
            <MessageSquareText size={ICON.lg} aria-hidden="true" />
            <p>
              <strong>강의실 사용 방식</strong>
              수업자료를 흑백반전한 PPT로 만들고 리모컨으로 넘겨가며 수업할 수 있습니다.
            </p>
          </div>
        </div>

        <div className={styles.matchupScreens}>
          <ProductFrame
            label="01 · 적중 자료 확인"
            detail="실제 시험 ↔ 사전 자료"
            image="/promo/matchup-actual-vs-prepared-q2-20260726.jpg"
            alt="실제 시험 문제와 시험 전에 다룬 학원 자료를 나란히 비교한 적중 보고서 예시"
            imageWidth={1263}
            imageHeight={893}
          />
          <span className={styles.screenArrow} aria-hidden="true">
            별도
          </span>
          <ProductFrame
            label="02 · 칠판용 PPT"
            detail="흑백반전 · 16:9"
            image="/promo/ppt-gaepo-ready-panel-20260726.png"
            alt="흑백반전한 문제 자료를 칠판용 PPT로 미리 보는 학원플러스 화면"
          />
        </div>

        <ol className={styles.matchupSteps}>
          {MATCHUP_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon size={ICON.lg} aria-hidden="true" />
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </li>
            );
          })}
        </ol>
        <div className={styles.inlineActions}>
          <Link to="/promo/matchup-ppt" className={styles.darkButton}>
            두 기능 실제 화면 보기
            <ArrowRight size={ICON.md} aria-hidden="true" />
          </Link>
          <Link to="/promo/demo" className={styles.textLink}>
            내 시험지로 확인하기
            <ArrowRight size={ICON.sm} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function OperationsSection() {
  return (
    <section className={styles.operationsSection} aria-labelledby="operations-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>수업 전후 실제 화면</span>
          <h2 id="operations-title">선생님이 일하는 순서대로 이어집니다</h2>
          <p>성적, 영상, 알림톡을 관리할 때 쓰는 실제 화면입니다.</p>
        </header>

        <div className={styles.operationList}>
          {OPERATIONS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className={styles.operationRow} data-kind={item.kind} data-reverse={index % 2 === 1}>
                <div className={styles.operationVisual}>
                  <PromoEvidenceImage
                    src={item.image}
                    alt={item.alt}
                    width={item.imageWidth}
                    height={item.imageHeight}
                    loading="lazy"
                  />
                  <span>실제 화면 · 예시 자료</span>
                </div>
                <div className={styles.operationCopy}>
                  <span>
                    <Icon size={ICON.sm} aria-hidden="true" />
                    {item.eyebrow}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <ul>
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check size={ICON.sm} aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link to={item.href}>
                    {item.cta}
                    <ArrowRight size={ICON.sm} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
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
            <h2 id="start-title">현재 방식에 맞춰 필요한 기능부터 적용합니다</h2>
            <p>
              현재 자료와 관리 방식을 확인하고, 먼저 사용할 기능과 일정을 함께 정합니다.
            </p>
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
          <GraduationCap size={ICON.md} aria-hidden="true" />
          선생님의 자료로 확인하세요
        </span>
        <h2 id="final-cta-title">선생님의 시험지와 수업자료를 기준으로 안내합니다</h2>
        <p>현재 쓰는 자료와 수업 방식을 알려주시면 필요한 기능과 화면을 준비해 보여드립니다.</p>
        <div className={styles.finalActions}>
          <Link to="/promo/demo" className={styles.primaryButton}>
            내 자료로 데모 요청
            <ArrowRight size={ICON.md} aria-hidden="true" />
          </Link>
          <Link to="/promo/features" className={styles.secondaryButton}>
            실제 화면 더 보기
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
      <AudienceStrip />
      <ValueSection />
      <MatchupShowcase />
      <OperationsSection />
      <StartSection />
      <FinalCta />
    </>
  );
}
