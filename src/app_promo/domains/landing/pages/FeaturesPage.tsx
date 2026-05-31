import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import CtaSection from "../components/CtaSection";
import styles from "./PromoPages.module.css";

type ProofCard = {
  id: string;
  badge: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  points: string[];
  ctaPath: string;
  ctaLabel: string;
  tone: "video" | "alimtalk" | "admin";
  phone?: boolean;
  featured?: boolean;
};

type FeatureGroup = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  icon: LucideIcon;
  accentBg: string;
  items: { title: string; desc: string }[];
};

const PROOF_CARDS: ProofCard[] = [
  {
    id: "parent-trust",
    badge: "학부모 리포트",
    title: "출결·성적·복습·보강 내역을 상담 전에 보낼 수 있습니다",
    body: "선생님이 매번 다시 설명하던 내용을 주간 리포트와 알림톡으로 먼저 보여줍니다.",
    image: "/promo/admin-scores.png",
    alt: "학부모 리포트 예시 화면",
    points: ["이번 주 출결·응시·영상 시청 요약", "보강 대상과 다음 안내 확인", "알림톡·소개 페이지에 활용"],
    ctaPath: "/promo/parent-trust",
    ctaLabel: "학부모 리포트 보기",
    tone: "admin",
    featured: true,
  },
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "수강생은 앱에서 영상을 이어 보고, 선생님은 시청 이력으로 챙깁니다",
    body: "외부 링크를 따로 보내지 않아도 학생전용앱 안에서 강의 목록, 재생, 댓글, 이어보기가 됩니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어와 댓글 화면",
    points: ["영상 플레이어, 댓글, 좋아요가 학생앱 안에 표시", "마지막 재생 위치와 시청 상태 확인", "미시청 학생에게 영상 확인 알림톡 발송"],
    ctaPath: "/promo/video-platform",
    ctaLabel: "영상 기능 상세 보기",
    tone: "video",
    phone: true,
  },
  {
    id: "alimtalk",
    badge: "관리자 자동 발송 화면",
    title: "반복해서 보내던 알림톡을 줄입니다",
    body: "가입, 출결, 시험, 과제, 결제, 영상 안내처럼 자주 보내는 연락을 템플릿으로 관리합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 자동 발송 설정 화면",
    points: ["상황별 자동 발송 조건 설정", "자동·수동 발송 상태를 화면에서 구분", "승인 템플릿과 발송 채널 관리"],
    ctaPath: "/promo/features#communication",
    ctaLabel: "알림톡 기능 보기",
    tone: "alimtalk",
  },
  {
    id: "exam-proof",
    badge: "시험·성적 관리",
    title: "시험이 끝난 뒤 채점, 분석, 보강까지 이어집니다",
    body: "시험 운영, 점수 입력, 성적 분석, 보강 판단을 따로 찾지 않고 한 화면에서 확인합니다.",
    image: "/promo/admin-scores.png",
    alt: "관리자 성적 분석 화면",
    points: ["수강생별 성적과 미처리 확인", "AI 채점 결과는 강사가 검수", "성적표와 수업 결과 안내에 반영"],
    ctaPath: "/promo/ai-grading",
    ctaLabel: "AI 채점 상세 보기",
    tone: "admin",
  },
];

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "parent-report",
    title: "학부모 리포트",
    kicker: "상담 전 설명",
    body: "학부모는 이번 주에 무엇을 챙겼는지를 알고 싶어 합니다. 출결, 성적, 영상, 보강 내역을 짧은 리포트로 보냅니다.",
    icon: ShieldCheck,
    accentBg: "#c8f4ec",
    items: [
      { title: "주간 리포트 요약", desc: "수업 참여, 시험 결과, 영상 시청, 보강 필요 여부를 한 주 단위로 보여줍니다." },
      { title: "다음 조치 안내", desc: "취약 문항, 미시청 영상, 보강 후보를 학부모가 이해하기 쉽게 적습니다." },
      { title: "알림톡 발송", desc: "리포트 내용을 수업 결과, 영상 확인, 보강 안내 알림톡으로 보냅니다." },
      { title: "홍보 자료 활용", desc: "적중 리포트와 학교별 내신반 소개 페이지에도 같은 자료를 씁니다." },
    ],
  },
  {
    id: "class-management",
    title: "수업·수강생 관리",
    kicker: "수업 준비",
    body: "선생님이 매일 확인하는 강의, 차시, 담당 수강생, 출결 상태를 한 화면에 모았습니다.",
    icon: BookOpenCheck,
    accentBg: "#dff7f4",
    items: [
      { title: "강의·차시 구조", desc: "강의 목록, 지난 강의, 수강생, 출결, 리포트를 함께 관리합니다." },
      { title: "수강생 상태 관리", desc: "수강 상태, 메모, 담당 강사, 학부모 연락처를 수업 화면에서 확인합니다." },
      { title: "출결 기록", desc: "입실, 결석, 보강 필요 여부를 남기고 알림톡으로 안내합니다." },
      { title: "오늘 할 일 확인", desc: "미답변 질문, 학생 제출, 채점·성적, 영상 관리를 대시보드에서 바로 확인합니다." },
    ],
  },
  {
    id: "exam-score",
    title: "시험·과제·성적",
    kicker: "시험 후 처리",
    body: "시험이 끝난 뒤 선생님이 해야 하는 채점, 분석, 피드백, 보강 판단을 이어서 처리합니다.",
    icon: ClipboardCheck,
    accentBg: "#e7ecff",
    items: [
      { title: "시험 생성", desc: "객관식, OX형, 단답형, 서술형 등 문항 유형별 채점 정책을 설정합니다." },
      { title: "과제 제출 확인", desc: "제출 대기, 제출 완료, 미처리 상태를 선생님이 바로 판단할 수 있게 보여줍니다." },
      { title: "성적 분석", desc: "점수 입력, 총점 계산, 시험별·수강생별 분석을 한 화면에서 봅니다." },
      { title: "피드백 기록", desc: "수업 결과와 성적 코멘트를 남기고 학부모에게 안내합니다." },
    ],
  },
  {
    id: "student-video-flow",
    title: "학생전용앱 영상 학습",
    kicker: "학생앱 복습",
    body: "학생은 앱에서 바로 복습하고, 선생님은 시청 상태를 보고 챙길 학생을 찾습니다.",
    icon: Smartphone,
    accentBg: "#fff0d2",
    items: [
      { title: "앱 안의 영상 목록", desc: "수강생은 학생전용앱에서 강의별 영상 목록과 재생 목록을 확인합니다." },
      { title: "자체 플레이어", desc: "이어보기, 배속, 전체화면, 댓글을 앱 안에서 제공합니다." },
      { title: "시청 이력", desc: "시청 시간, 마지막 위치, 완료 여부를 확인합니다." },
      { title: "영상 안내", desc: "미시청 학생에게 복습 영상을 확인하라고 알림톡을 보냅니다." },
    ],
  },
  {
    id: "communication",
    title: "알림톡·학부모 커뮤니케이션",
    kicker: "학부모 안내",
    body: "반복 연락은 줄이고, 중요한 피드백은 선생님 말투가 남도록 템플릿을 잡습니다.",
    icon: BellRing,
    accentBg: "#ffe7ef",
    items: [
      { title: "알림톡 자동 발송", desc: "가입, 출결, 시험, 과제, 클리닉, 결제 상황별 발송 조건을 설정합니다." },
      { title: "입실·결석 안내", desc: "출결 처리와 동시에 학부모에게 상황을 알려 반복 연락을 줄입니다." },
      { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 기준으로 수업 결과 안내를 보냅니다." },
      { title: "질문 응답", desc: "학생 질문과 강사 답변을 남겨 수업 이후 대화가 흩어지지 않게 합니다." },
    ],
  },
  {
    id: "clinic",
    title: "보강·클리닉·후속 조치",
    kicker: "수업 후 조치",
    body: "성적이 낮거나 영상을 보지 않은 학생을 그냥 넘기지 않도록 챙길 목록을 만듭니다.",
    icon: GraduationCap,
    accentBg: "#e7f7fb",
    items: [
      { title: "보강 예약", desc: "보강 일정을 등록하고 학생별 보강 이력을 확인합니다." },
      { title: "클리닉 메모", desc: "상담, 피드백, 약점, 과제 이력을 학생별로 누적합니다." },
      { title: "후속 대상자 판단", desc: "성적, 과제, 영상 시청 상태를 보고 다음 조치가 필요한 학생을 찾습니다." },
      { title: "학부모 안내 자료", desc: "선생님이 학부모에게 설명할 내용을 화면에 남깁니다." },
    ],
  },
];

const NAV_LINKS = [
  { label: "학부모 리포트", href: "#parent-trust" },
  { label: "학생앱 영상", href: "#student-video" },
  { label: "알림톡 자동 발송", href: "#alimtalk" },
  { label: "시험·성적", href: "#exam-score" },
  { label: "커뮤니케이션", href: "#communication" },
  { label: "보강·클리닉", href: "#clinic" },
];

export default function FeaturesPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroFeatures}`} aria-labelledby="features-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>실제 화면 중심</span>
            <h1 id="features-title">수업 전후에 처리할 일을 화면별로 모았습니다</h1>
            <p>
              출결, 시험, 영상, 알림톡, 보강이 따로 흩어지면 확인할 일이 늘어납니다.
              학원플러스는 선생님이 자주 보는 화면을 기준으로 수업 전후 업무를 묶었습니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/parent-trust" className={styles.primaryCta}>
                학부모 리포트 보기
                <ShieldCheck size={18} />
              </Link>
              <a href="#alimtalk" className={styles.secondaryCta}>
                알림톡 발송 보기
                <MessageSquareText size={18} />
              </a>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="핵심 기능 미리보기">
            <figure className={styles.heroScreen}>
              <img src="/promo/student-video-player.png" alt="학생전용앱 영상 플레이어 화면" />
              <figcaption className={styles.heroScreenCaption}>
                <strong>학생전용앱 영상</strong>
                <span>이어보기 · 댓글 · 플레이어</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <strong>알림톡 자동 발송</strong>
                <p>가입, 출결, 시험, 영상 안내를 필요한 순간에 발송합니다.</p>
              </article>
              <article>
                <strong>학부모 리포트</strong>
                <p>출결, 성적, 영상, 보강 내역을 한 주 단위로 요약합니다.</p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="proof-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <Sparkles size={16} />
              실제 화면
            </span>
            <h2 id="proof-title">말보다 먼저 보여줄 화면</h2>
            <p>
              기능 이름만 나열하면 와닿지 않습니다. 학생앱, 관리자 화면, 리포트 예시를 먼저 보여주고
              실제 수업에서 언제 쓰는지 짧게 붙였습니다.
            </p>
          </header>

          <div className={styles.proofGrid}>
            {PROOF_CARDS.map((card) => (
              <article
                key={card.id}
                id={card.id}
                className={`${styles.proofCard} ${card.featured ? styles.proofCardFeatured : ""}`}
                data-tone={card.tone}
              >
                <div className={`${styles.proofVisual} ${card.phone ? styles.proofPhoneVisual : ""}`}>
                  <img src={card.image} alt={card.alt} loading="lazy" />
                </div>
                <div className={styles.proofText}>
                  <span className={styles.proofBadge}>{card.badge}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.points.map((point) => (
                      <li key={point}>
                        <CheckCircle2 size={16} />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link to={card.ctaPath} className={styles.textButton}>
                    {card.ctaLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.catalogSection} aria-labelledby="feature-catalog-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>기능 목록</span>
            <h2 id="feature-catalog-title">선생님이 일하는 순서대로 나눴습니다</h2>
            <p>단순히 기능이 있다는 말보다, 어떤 일을 줄여주는지 먼저 보이게 했습니다.</p>
          </header>

          <div className={styles.catalogLayout}>
            <aside className={styles.catalogRail} aria-label="기능 바로가기">
              <span className={styles.railTitle}>바로가기</span>
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                  <ArrowRight size={14} />
                </a>
              ))}
            </aside>

            <div className={styles.groupStack}>
              {FEATURE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <article key={group.id} id={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupIcon} style={{ "--accent-bg": group.accentBg } as CSSProperties}>
                        <Icon size={22} />
                      </span>
                      <div>
                        <span className={styles.groupKicker}>{group.kicker}</span>
                        <h2>{group.title}</h2>
                        <p>{group.body}</p>
                      </div>
                    </div>
                    <div className={styles.featureGrid}>
                      {group.items.map((item) => (
                        <div key={item.title} className={styles.featureItem}>
                          <strong>{item.title}</strong>
                          <p>{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
