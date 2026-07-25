import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Presentation,
  ScanSearch,
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
  imageWidth: number;
  imageHeight: number;
  points: string[];
  ctaPath: string;
  ctaLabel: string;
  tone: "video" | "alimtalk" | "admin" | "matchup";
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
    id: "matchup-ppt",
    badge: "공개 적중 사례 · 2026 숙명여고",
    title: "적중 근거를 남기고, 수업자료는 칠판용 PPT로 만듭니다",
    body: "실제 시험과 우리 학원 사전 자료를 비교합니다. 별도로 문제·개념 자료를 나누고 흑백반전해 빔프로젝터용 PPT를 만듭니다.",
    image: "/promo/matchup-actual-vs-prepared-q1-20260726.jpg",
    alt: "2026 숙명여고 실제 시험 문제와 시험 전에 다룬 학원 자료를 나란히 비교한 적중 보고서",
    imageWidth: 1263,
    imageHeight: 893,
    points: ["실제 시험 ↔ 사전 대비 자료 비교", "선생님이 적중 근거 최종 확인", "문제·개념 분할·흑백반전 PPT"],
    ctaPath: "/promo/matchup-ppt",
    ctaLabel: "매치업·칠판 PPT 실제 화면 보기",
    tone: "matchup",
    featured: true,
  },
  {
    id: "parent-trust",
    badge: "학부모 상담 자료",
    title: "출결·성적·복습·보강 기록을 보며 상담할 수 있습니다",
    body: "수업 중에 남긴 기록을 확인하고, 이번 상담에 필요한 내용만 선생님이 골라 설명합니다.",
    image: "/promo/admin-scores.png",
    alt: "수강생별 성적과 미처리 상태를 확인하는 학원플러스 관리자 화면",
    imageWidth: 1440,
    imageHeight: 820,
    points: ["출결·응시·영상 시청 기록 확인", "보강 대상과 다음 조치 판단", "확인한 내용을 알림톡·상담에 활용"],
    ctaPath: "/promo/parent-trust",
    ctaLabel: "상담 자료 흐름 보기",
    tone: "admin",
  },
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "수강생은 앱에서 영상을 이어 보고, 선생님은 시청 이력으로 챙깁니다",
    body: "외부 링크를 따로 보내지 않아도 학생전용앱 안에서 강의 목록, 재생, 댓글, 이어보기가 됩니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어와 댓글 화면",
    imageWidth: 780,
    imageHeight: 1688,
    points: ["영상 플레이어, 댓글, 좋아요가 학생앱 안에 표시", "마지막 재생 위치와 시청 상태 확인", "미시청 학생에게 영상 확인 알림톡 발송"],
    ctaPath: "/promo/video-platform",
    ctaLabel: "영상 기능 상세 보기",
    tone: "video",
    phone: true,
  },
  {
    id: "alimtalk",
    badge: "관리자 알림톡 화면",
    title: "승인된 알림톡 양식으로 반복 안내를 정리합니다",
    body: "가입, 출결, 시험, 클리닉처럼 자주 보내는 연락을 양식별로 관리하고 발송 전 내용을 확인합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 발송 설정 화면",
    imageWidth: 1440,
    imageHeight: 820,
    points: ["승인된 공용 알림톡 양식 사용", "자동·수동 발송 상태를 화면에서 구분", "대상과 선생님 메모를 발송 전에 확인"],
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
    imageWidth: 1440,
    imageHeight: 820,
    points: ["수강생별 성적과 미처리 확인", "AI 채점 결과는 강사가 검수", "성적표와 수업 결과 안내에 반영"],
    ctaPath: "/promo/ai-grading",
    ctaLabel: "AI 채점 상세 보기",
    tone: "admin",
  },
];

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "matchup-ppt-flow",
    title: "적중 매치업·칠판용 PPT",
    kicker: "수업자료 제작",
    body: "실제 시험과 사전 대비 자료를 비교해 적중 근거를 남기고, 별도로 수업자료를 빔프로젝터용 PPT로 만듭니다.",
    icon: Presentation,
    accentBg: "#dce8ff",
    items: [
      { title: "실제 시험 등록", desc: "학교 시험에 실제로 출제된 문제를 학교·학기·시험별로 정리합니다." },
      { title: "사전 자료 비교", desc: "우리 학원이 시험 전에 다룬 유사 문제를 나란히 보고 적중 근거를 확정합니다." },
      { title: "문제·개념 분할", desc: "수업자료를 문제나 개념 단위로 나누고 슬라이드 순서를 정합니다." },
      { title: "칠판용 PPT", desc: "흑백반전과 밝기·대비를 적용해 16:9·4:3 PPT로 내려받습니다." },
    ],
  },
  {
    id: "parent-report",
    title: "학부모 상담에 필요한 기록",
    kicker: "상담 전 설명",
    body: "학부모가 궁금해하는 출결, 성적, 영상, 보강 내역을 화면에서 확인하고 상담과 안내에 활용합니다.",
    icon: ShieldCheck,
    accentBg: "#c8f4ec",
    items: [
      { title: "수업 기록 확인", desc: "수업 참여, 시험 결과, 영상 시청, 보강 필요 여부를 실제 화면에서 확인합니다." },
      { title: "다음 조치 판단", desc: "취약 문항, 미시청 영상, 보강 후보 중 이번에 안내할 내용을 고릅니다." },
      { title: "선생님 최종 검수", desc: "알림톡을 보내기 전에 대상과 선생님 메모를 확인합니다." },
      { title: "상담 자료 활용", desc: "적중 리포트와 학교별 내신반 소개 화면을 상담에 함께 활용합니다." },
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
      { title: "강의·차시 구조", desc: "강의 목록, 지난 강의, 수강생, 출결 기록을 함께 관리합니다." },
      { title: "수강생 상태 관리", desc: "수강 상태, 메모, 담당 강사, 학부모 연락처를 수업 화면에서 확인합니다." },
      { title: "출결 기록", desc: "입실, 결석, 보강 필요 여부를 남기고 알림톡으로 안내합니다." },
      { title: "오늘 할 일 확인", desc: "미답변 질문, 학생 제출, 채점·성적, 영상 관리를 대시보드에서 확인합니다." },
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
      { title: "과제 제출 확인", desc: "제출 대기, 제출 완료, 미처리 상태를 선생님이 판단할 수 있게 보여줍니다." },
      { title: "성적 분석", desc: "점수 입력, 총점 계산, 시험별·수강생별 분석을 한 화면에서 봅니다." },
      { title: "피드백 기록", desc: "수업 결과와 성적 코멘트를 남기고 학부모에게 안내합니다." },
    ],
  },
  {
    id: "student-video-flow",
    title: "학생전용앱 영상 학습",
    kicker: "학생앱 복습",
    body: "학생은 앱에서 복습하고, 선생님은 시청 상태를 보고 챙길 학생을 찾습니다.",
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
      { title: "승인된 알림톡 양식", desc: "가입, 출결, 시험, 클리닉 등 상황에 맞는 공용 승인 양식을 사용합니다." },
      { title: "입실·결석 안내", desc: "출결 안내가 설정된 경우 발송 상태를 확인하고 반복 연락을 줄입니다." },
      { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 보고 선생님이 내용을 확인한 뒤 보냅니다." },
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
  { label: "매치업·칠판 PPT", href: "#matchup-ppt" },
  { label: "학부모 상담 자료", href: "#parent-trust" },
  { label: "학생앱 영상", href: "#student-video" },
  { label: "알림톡 안내", href: "#alimtalk" },
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
            <span className={styles.eyebrow}>대치 수업 운영 · 실제 화면 중심</span>
            <h1 id="features-title">적중 근거와 칠판용 PPT, 수업 전후의 일을 줄입니다</h1>
            <p>
              실제 시험과 사전 자료 비교, 칠판용 PPT 제작부터 출결, 성적, 영상, 알림톡, 보강까지.
              대치 선생님이 수업 전후에 실제로 보는 화면을 기준으로 기능을 묶었습니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/matchup-ppt" className={styles.primaryCta}>
                매치업·칠판 PPT 보기
                <Presentation size={18} />
              </Link>
              <a href="#parent-trust" className={styles.secondaryCta}>
                전체 실제 화면 보기
                <ScanSearch size={18} />
              </a>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="핵심 기능 미리보기">
            <figure className={styles.heroScreen}>
              <img
                src="/promo/ppt-gaepo-setup-20260725.png"
                alt="개포고 문제 자료를 나누고 흑백반전 칠판용 PPT로 구성하는 실제 화면"
                width={1280}
                height={720}
              />
              <figcaption className={styles.heroScreenCaption}>
                <strong>문항 분할 → 흑백반전 PPT</strong>
                <span>제품 실화면 · 2장 · 16:9</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <Camera size={16} />
                <strong>적중 매치업</strong>
                <p>실제 시험과 우리 학원 사전 자료를 비교합니다.</p>
              </article>
              <article>
                <ScanSearch size={16} />
                <strong>칠판용 PPT</strong>
                <p>자료를 나누고 흑백반전해 수업에 씁니다.</p>
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
              기능 이름만 나열하지 않았습니다. 매치업, PPT, 학생앱, 관리자 화면을 실제 수업에서
              언제 쓰는지와 함께 보여드립니다.
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
                  <img
                    src={card.image}
                    alt={card.alt}
                    width={card.imageWidth}
                    height={card.imageHeight}
                    loading="lazy"
                  />
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
