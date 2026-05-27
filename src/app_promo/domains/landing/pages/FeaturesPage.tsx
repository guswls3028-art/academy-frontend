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
    badge: "학부모 신뢰 리포트",
    title: "출결·성적·영상·보강 근거가 상담 전 리포트로 정리됩니다",
    body: "강사님이 매번 설명하던 수업 근거를 주간 리포트와 알림톡 안내로 묶어 학부모가 먼저 이해하게 합니다.",
    image: "/promo/admin-scores.png",
    alt: "학부모 신뢰 리포트 근거 화면",
    points: ["이번 주 출결·응시·영상 시청 요약", "보강 대상과 다음 조치 자동 정리", "알림톡·랜딩 홍보 흐름으로 연결"],
    ctaPath: "/promo/parent-trust",
    ctaLabel: "신뢰 리포트 보기",
    tone: "admin",
    featured: true,
  },
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "수강생은 앱에서 영상을 이어 보고, 강사님은 시청 이력으로 챙깁니다",
    body: "영상 기능은 강사님이 학부모에게 설명하기 가장 쉬운 상품 포인트입니다. 외부 링크가 아니라 학생전용앱 안에서 강의 목록, 재생, 댓글, 이어보기가 연결됩니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어와 댓글 화면",
    points: ["영상 플레이어, 댓글, 좋아요가 학생앱 안에 표시", "마지막 재생 위치와 시청 상태를 후속 지도에 활용", "미시청 학생에게 영상 확인 알림톡으로 연결"],
    ctaPath: "/promo/video-platform",
    ctaLabel: "영상 기능 상세 보기",
    tone: "video",
    phone: true,
  },
  {
    id: "alimtalk",
    badge: "관리자 자동발송 화면",
    title: "알림톡 자동발송은 반복 연락을 운영 이벤트로 바꿉니다",
    body: "가입, 출결, 시험, 과제, 결제, 영상 안내처럼 반복되는 상황을 템플릿과 발송 시점으로 묶어 관리합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 자동발송 설정 화면",
    points: ["운영 구간별 자동발송 트리거 설정", "항상 활성·수동 발송 상태를 화면에서 구분", "승인 템플릿과 발송 채널을 한 곳에서 관리"],
    ctaPath: "/promo/features#communication",
    ctaLabel: "알림톡 기능 보기",
    tone: "alimtalk",
  },
  {
    id: "exam-proof",
    badge: "시험·성적 흐름",
    title: "시험과 성적은 채점에서 멈추지 않고 피드백으로 이어집니다",
    body: "시험 운영, 점수 입력, 성적 분석, 보강 판단이 따로 흩어지지 않게 같은 흐름에서 보이도록 정리합니다.",
    image: "/promo/admin-scores.png",
    alt: "관리자 성적 분석 화면",
    points: ["수강생별 성적과 미처리 확인", "AI 채점은 강사 검수 구조로 설명", "성적표와 수업결과 안내로 연결"],
    ctaPath: "/promo/ai-grading",
    ctaLabel: "AI 채점 상세 보기",
    tone: "admin",
  },
];

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "parent-report",
    title: "학부모 신뢰 리포트",
    kicker: "PARENT TRUST",
    body: "대치형 구매 포인트는 관리 근거입니다. 출결, 성적, 영상, 보강 이력을 학부모가 이해하는 리포트 흐름으로 묶습니다.",
    icon: ShieldCheck,
    accentBg: "#c8f4ec",
    items: [
      { title: "주간 리포트 요약", desc: "수업 참여, 시험 결과, 영상 시청, 보강 필요 여부를 한 주 단위로 정리합니다." },
      { title: "다음 조치 제안", desc: "취약 문항, 미시청 영상, 보강 후보를 학부모에게 설명 가능한 문장으로 묶습니다." },
      { title: "알림톡 연결", desc: "리포트 내용을 수업결과·영상 확인·보강 안내 알림톡으로 이어 보냅니다." },
      { title: "홍보 재사용", desc: "적중 리포트와 학교별 내신반 소개 페이지에 쓸 근거로 재가공합니다." },
    ],
  },
  {
    id: "class-management",
    title: "수업·수강생 관리",
    kicker: "CLASS CONTROL",
    body: "강사님이 매일 확인하는 강의, 차시, 담당 수강생, 출결 상태를 한 화면 흐름으로 묶습니다.",
    icon: BookOpenCheck,
    accentBg: "#dff7f4",
    items: [
      { title: "강의·차시 구조", desc: "강의 목록, 지난 강의, 수강생, 출결, 리포트를 같은 도메인에서 관리합니다." },
      { title: "수강생 상태 관리", desc: "수강 상태, 메모, 담당 강사, 학부모 연락 흐름을 수업 운영 기준으로 정리합니다." },
      { title: "출결 기록", desc: "입실, 결석, 보강 필요 여부를 남기고 알림톡 안내와 연결합니다." },
      { title: "오늘 할 일 확인", desc: "미답변 질문, 학생 제출, 채점·성적, 영상 관리를 대시보드에서 바로 확인합니다." },
    ],
  },
  {
    id: "exam-score",
    title: "시험·과제·성적",
    kicker: "TEST TO FEEDBACK",
    body: "시험이 끝난 뒤 강사님이 해야 하는 채점, 분석, 피드백, 보강 판단을 이어주는 영역입니다.",
    icon: ClipboardCheck,
    accentBg: "#e7ecff",
    items: [
      { title: "시험 생성", desc: "객관식, OX형, 단답형, 서술형 등 문항 유형별 채점 정책을 설정합니다." },
      { title: "과제 제출 확인", desc: "제출 대기, 제출 완료, 미처리 상태를 강사님이 바로 판단할 수 있게 보여줍니다." },
      { title: "성적 분석", desc: "점수 입력, 총점 계산, 시험별·수강생별 분석을 후속 지도 자료로 남깁니다." },
      { title: "피드백 기록", desc: "수업 결과와 성적 코멘트를 남기고 학부모 안내로 이어갈 수 있습니다." },
    ],
  },
  {
    id: "student-video-flow",
    title: "학생전용앱 영상 학습",
    kicker: "STUDENT VIDEO",
    body: "선생님들이 좋아할 핵심 기능입니다. 학생이 앱에서 바로 복습하고, 강사님은 시청 상태를 근거로 지도합니다.",
    icon: Smartphone,
    accentBg: "#fff0d2",
    items: [
      { title: "앱 안의 영상 목록", desc: "수강생은 학생전용앱에서 강의별 영상 목록과 재생 목록을 확인합니다." },
      { title: "자체 플레이어", desc: "이어보기, 배속, 전체화면, 댓글을 학습 흐름에 맞게 제공합니다." },
      { title: "시청 이력", desc: "시청 시간, 마지막 위치, 완료 여부를 확인해 후속 지도를 잡습니다." },
      { title: "영상 안내 연결", desc: "미시청 학생에게 복습 영상 확인을 알림톡으로 자연스럽게 안내합니다." },
    ],
  },
  {
    id: "communication",
    title: "알림톡·학부모 커뮤니케이션",
    kicker: "PARENT TOUCHPOINT",
    body: "반복 연락은 자동화하고, 중요한 피드백은 선생님 말투가 유지되도록 템플릿 기준을 잡습니다.",
    icon: BellRing,
    accentBg: "#ffe7ef",
    items: [
      { title: "알림톡 자동발송", desc: "가입, 출결, 시험, 과제, 클리닉, 결제, 커뮤니티 이벤트별 자동발송을 설정합니다." },
      { title: "입실·결석 안내", desc: "출결 처리와 동시에 학부모에게 상황을 알려 반복 연락을 줄입니다." },
      { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 기준으로 수업 결과 안내를 보냅니다." },
      { title: "질문 응답 흐름", desc: "학생 질문과 강사 답변을 남겨 수업 이후 커뮤니케이션을 정리합니다." },
    ],
  },
  {
    id: "clinic",
    title: "보강·클리닉·후속 조치",
    kicker: "AFTER CLASS",
    body: "성적이 낮거나 영상을 보지 않은 학생을 그냥 넘기지 않도록 후속 조치의 근거를 남깁니다.",
    icon: GraduationCap,
    accentBg: "#e7f7fb",
    items: [
      { title: "보강 예약", desc: "보강 일정을 등록하고 학생별 보강 이력을 확인합니다." },
      { title: "클리닉 메모", desc: "상담, 피드백, 약점, 과제 이력을 학생별로 누적합니다." },
      { title: "후속 대상자 판단", desc: "성적, 과제, 영상 시청 상태를 기준으로 다음 조치가 필요한 학생을 찾습니다." },
      { title: "운영 리포트", desc: "강사님이 학부모에게 설명할 수 있는 근거를 화면에 남깁니다." },
    ],
  },
];

const NAV_LINKS = [
  { label: "학부모 리포트", href: "#parent-trust" },
  { label: "학생앱 영상", href: "#student-video" },
  { label: "알림톡 자동발송", href: "#alimtalk" },
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
            <span className={styles.eyebrow}>FEATURES THAT TEACHERS CAN TRUST</span>
            <h1 id="features-title">기능 목록이 아니라, 학부모가 믿는 근거로 보여드립니다</h1>
            <p>
              강사님이 실제 홍보 전에 확인해야 할 핵심은 “학생이 무엇을 했고, 선생님은 무엇을 근거로 관리하는가”입니다.
              학부모 신뢰 리포트, 학생전용앱 영상, 알림톡 자동발송을 증거 화면 중심으로 먼저 배치했습니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/parent-trust" className={styles.primaryCta}>
                신뢰 리포트 보기
                <ShieldCheck size={18} />
              </Link>
              <a href="#alimtalk" className={styles.secondaryCta}>
                알림톡 자동발송 보기
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
                <strong>알림톡 자동발송</strong>
                <p>가입, 출결, 시험, 영상 안내를 이벤트 기준으로 발송합니다.</p>
              </article>
              <article>
                <strong>학부모 신뢰 리포트</strong>
                <p>출결, 성적, 영상, 보강 근거를 한 주 단위로 요약합니다.</p>
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
              PRODUCT PROOF
            </span>
            <h2 id="proof-title">선생님이 “이건 학부모에게 설명된다”고 느낄 화면</h2>
            <p>
              기능명만 나열하면 설득력이 약합니다. 실제 리포트 근거, 학생앱, 관리자 화면을 크게 보여주고
              강사님이 수업 운영에서 체감할 이유를 바로 붙였습니다.
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
            <span>FEATURE CATALOG</span>
            <h2 id="feature-catalog-title">전체 기능도 학부모 신뢰 흐름으로 정리했습니다</h2>
            <p>강사님이 읽는 페이지라서 “있습니다”보다 “어떤 근거를 남기고 어떤 설명이 줄어드는지”를 기준으로 묶었습니다.</p>
          </header>

          <div className={styles.catalogLayout}>
            <aside className={styles.catalogRail} aria-label="기능 바로가기">
              <span className={styles.railTitle}>핵심 섹션</span>
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
