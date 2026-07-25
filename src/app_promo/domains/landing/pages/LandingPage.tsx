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
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import styles from "./LandingPage.module.css";

const AUDIENCES = [
  {
    label: "개인 강사",
    copy: "시험지와 수업자료 제작 시간을 줄이고 싶은 선생님",
  },
  {
    label: "학원 원장",
    copy: "여러 반의 수업 기록과 학부모 안내를 한곳에서 보고 싶은 원장님",
  },
  {
    label: "운영 실장",
    copy: "출결·성적·영상·보강의 누락을 줄이고 싶은 운영 담당자",
  },
];

const VALUE_ITEMS = [
  {
    icon: Presentation,
    title: "찍은 시험지를 수업자료로",
    copy: "시험지 이미지를 올리고 유사문제 후보를 직접 확인한 뒤, 고른 문제를 PPT로 이어서 만듭니다.",
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
    title: "시험지 촬영·업로드",
    copy: "휴대폰으로 찍은 문제 이미지나 PDF를 학교·시험별 자료함에 넣습니다.",
  },
  {
    icon: ScanSearch,
    title: "후보 나란히 비교",
    copy: "원문 옆에서 유사문제 후보와 출처를 보고 수업에 맞는 문제를 직접 고릅니다.",
  },
  {
    icon: CheckCircle2,
    title: "선생님이 최종 선택",
    copy: "유사도는 참고값으로만 사용하고, 풀이 구조와 수업 목적을 기준으로 판단합니다.",
  },
  {
    icon: Presentation,
    title: "PPT 구성·다운로드",
    copy: "선택한 문제를 16:9 또는 4:3 슬라이드로 미리 본 뒤 수업용 파일로 내려받습니다.",
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
    image: "/promo/admin-scores.png",
    alt: "학원플러스 관리자 성적 관리 실제 화면",
    imageWidth: 1440,
    imageHeight: 820,
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
    image: "/promo/admin-messages.png",
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
    title: "지금 쓰는 방식부터 듣습니다",
    copy: "엑셀, 수기, 다른 솔루션을 억지로 한 번에 바꾸지 않고 먼저 줄일 업무를 고릅니다.",
  },
  {
    icon: FileText,
    title: "실제 자료로 화면을 보여드립니다",
    copy: "샘플 문구보다 선생님의 시험지와 수업 흐름으로 매치업·PPT와 운영 화면을 확인합니다.",
  },
  {
    icon: ShieldCheck,
    title: "가격과 별도 비용을 먼저 밝힙니다",
    copy: "평소 월 198,000원이며, 8월 가입자는 월 159,000원을 평생 보장합니다. 알림톡·추가 용량 등 별도 비용은 상담 전에 안내합니다.",
  },
];

function ProductFrame({
  label,
  detail,
  image,
  alt,
  eager = false,
}: {
  label: string;
  detail: string;
  image: string;
  alt: string;
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
      <img
        src={image}
        alt={alt}
        width={1280}
        height={720}
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
            대치 강사·원장을 위한 학원 운영 SaaS
          </span>
          <h1 id="promo-hero-title">
            <span>수업은 선생님답게.</span>
            <strong>반복 운영은 한곳에서.</strong>
          </h1>
          <p className={styles.heroLead}>
            시험지를 찍어 유사문제를 찾고 수업 PPT를 만듭니다. 출결·성적·영상·알림톡까지,
            수업 전후에 흩어진 일을 실제 화면 하나로 이어보세요.
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
          <ul className={styles.heroFacts} aria-label="제품 안내">
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              실제 제품 화면
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              선생님 최종 확인
            </li>
            <li>
              <Check size={ICON.sm} aria-hidden="true" />
              전체 기능 단일 요금
            </li>
          </ul>
        </div>

        <div className={styles.heroWorkbench} aria-label="시험지 매치업에서 수업 PPT까지 실제 제품 흐름">
          <div className={styles.workbenchLabel}>
            <span>오늘의 수업자료</span>
            <strong>개포고 파이널 모의고사</strong>
          </div>
          <ProductFrame
            label="유사문제 매치업"
            detail="원문과 후보 비교"
            image="/promo/matchup-gaepo-results-20260725.png"
            alt="개포고 시험 문제와 유사문제 후보를 비교하는 학원플러스 실제 화면"
            eager
          />
          <div className={styles.heroConnector} aria-hidden="true">
            <span>선택한 문제가 그대로</span>
            <ArrowRight size={ICON.md} />
          </div>
          <div className={styles.pptPreview}>
            <ProductFrame
              label="수업 PPT"
              detail="2장 · 16:9"
              image="/promo/ppt-gaepo-setup-20260725.png"
              alt="선택한 문제를 16대 9 수업 PPT로 구성하는 학원플러스 실제 화면"
              eager
            />
          </div>
          <div className={styles.proofStamp}>
            <CheckCircle2 size={ICON.md} aria-hidden="true" />
            <span>
              <strong>제품 실화면</strong>
              개포고 데모 데이터
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
          <h2 id="audience-title">수업은 잘하고 있는데, 운영이 자꾸 수업 시간을 가져갈 때</h2>
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
          <span>학원플러스가 줄이는 일</span>
          <h2 id="value-title">기능을 늘리는 대신, 같은 일을 두 번 하지 않게</h2>
          <p>수업 중 이미 만든 자료와 기록이 다음 업무로 자연스럽게 이어지도록 설계했습니다.</p>
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
            <span>가장 먼저 보여드릴 기능</span>
            <h2 id="matchup-title">스크린샷 한 장이 매치업을 거쳐 수업 PPT가 됩니다</h2>
            <p>
              학교 시험지를 다시 자르고 붙이는 대신, 원문과 유사문제 후보를 한 화면에서 확인하고
              선생님이 고른 문제만 수업자료로 가져갑니다.
            </p>
          </header>
          <div className={styles.teacherNote}>
            <MessageSquareText size={ICON.lg} aria-hidden="true" />
            <p>
              <strong>현장 강사 피드백</strong>
              “스크린샷을 찍으면 바로 PPT로 이어지는 흐름이 매치업과 잘 맞는다”는 의견을 제품 흐름에 반영했습니다.
            </p>
          </div>
        </div>

        <div className={styles.matchupScreens}>
          <ProductFrame
            label="01 · 후보 확인"
            detail="개포고 데모"
            image="/promo/matchup-gaepo-candidates-20260725.png"
            alt="개포고 시험 문제의 유사문제 후보를 확인하는 학원플러스 실제 화면"
          />
          <span className={styles.screenArrow} aria-hidden="true">
            <ArrowRight size={ICON.lg} />
          </span>
          <ProductFrame
            label="02 · PPT 구성"
            detail="2장 · 16:9"
            image="/promo/ppt-gaepo-ready-20260725.png"
            alt="선택한 문제를 수업용 PPT로 미리 보는 학원플러스 실제 화면"
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
            매치업·PPT 전체 과정
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
          <p>홍보용 예시 화면이 아니라 현재 제품에서 사용하는 관리자·학생 화면입니다.</p>
        </header>

        <div className={styles.operationList}>
          {OPERATIONS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className={styles.operationRow} data-kind={item.kind} data-reverse={index % 2 === 1}>
                <div className={styles.operationVisual}>
                  <img
                    src={item.image}
                    alt={item.alt}
                    width={item.imageWidth}
                    height={item.imageHeight}
                    loading="lazy"
                  />
                  <span>실제 제품 화면</span>
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
            <span>편안하게 시작하는 방법</span>
            <h2 id="start-title">새 시스템을 공부하는 일이 되지 않도록</h2>
            <p>
              모든 기능을 한 번에 바꾸는 대신, 지금 가장 오래 걸리는 일 하나부터 실제 자료로 확인합니다.
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
        <h2 id="final-cta-title">말로 설명하는 데모보다, 내 시험지로 보는 데모가 빠릅니다</h2>
        <p>현재 쓰는 자료와 수업 방식을 알려주시면 필요한 화면만 준비해 보여드립니다.</p>
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
