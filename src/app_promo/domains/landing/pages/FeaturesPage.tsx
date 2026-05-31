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
    title: "출결·성적·영상·보강 근거가 상담 전 리포트로 정리됩니다",
    body: "선생님이 매번 다시 설명하던 수업 근거를 주간 리포트와 알림톡 안내로 먼저 정리합니다.",
    image: "/promo/admin-scores.png",
    alt: "학부모 리포트 근거 화면",
    points: ["이번 주 출결·응시·영상 시청 요약", "보강 대상과 다음 조치 정리", "알림톡·공개 소개 페이지로 연결"],
    ctaPath: "/promo/parent-trust",
    ctaLabel: "학부모 리포트 보기",
    tone: "admin",
    featured: true,
  },
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "수강생은 앱에서 영상을 이어 보고, 선생님은 시청 이력으로 챙깁니다",
    body: "외부 링크를 따로 보내는 방식이 아니라 학생전용앱 안에서 강의 목록, 재생, 댓글, 이어보기가 연결됩니다.",
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
    badge: "관리자 자동 발송 화면",
    title: "알림톡 발송은 반복 연락을 줄이는 장치입니다",
    body: "가입, 출결, 시험, 과제, 결제, 영상 안내처럼 반복되는 상황을 템플릿과 발송 시점으로 묶어 관리합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 자동 발송 설정 화면",
    points: ["운영 구간별 자동 발송 조건 설정", "항상 활성·수동 발송 상태를 화면에서 구분", "승인 템플릿과 발송 채널을 한 곳에서 관리"],
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
    title: "학부모 리포트",
    kicker: "상담 전 설명",
    body: "학부모가 안심하는 지점은 관리 근거입니다. 출결, 성적, 영상, 보강 이력을 이해하기 쉬운 리포트로 묶습니다.",
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
    kicker: "수업 준비",
    body: "선생님이 매일 확인하는 강의, 차시, 담당 수강생, 출결 상태를 한 화면 흐름으로 묶습니다.",
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
    kicker: "시험 후 처리",
    body: "시험이 끝난 뒤 선생님이 해야 하는 채점, 분석, 피드백, 보강 판단을 이어주는 영역입니다.",
    icon: ClipboardCheck,
    accentBg: "#e7ecff",
    items: [
      { title: "시험 생성", desc: "객관식, OX형, 단답형, 서술형 등 문항 유형별 채점 정책을 설정합니다." },
      { title: "과제 제출 확인", desc: "제출 대기, 제출 완료, 미처리 상태를 선생님이 바로 판단할 수 있게 보여줍니다." },
      { title: "성적 분석", desc: "점수 입력, 총점 계산, 시험별·수강생별 분석을 후속 지도 자료로 남깁니다." },
      { title: "피드백 기록", desc: "수업 결과와 성적 코멘트를 남기고 학부모 안내로 이어갈 수 있습니다." },
    ],
  },
  {
    id: "student-video-flow",
    title: "학생전용앱 영상 학습",
    kicker: "학생앱 복습",
    body: "학생은 앱에서 바로 복습하고, 선생님은 시청 상태를 근거로 후속 지도를 잡습니다.",
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
    kicker: "학부모 안내",
    body: "반복 연락은 줄이고, 중요한 피드백은 선생님 말투가 유지되도록 템플릿 기준을 잡습니다.",
    icon: BellRing,
    accentBg: "#ffe7ef",
    items: [
      { title: "알림톡 자동 발송", desc: "가입, 출결, 시험, 과제, 클리닉, 결제, 커뮤니티 이벤트별 발송 조건을 설정합니다." },
      { title: "입실·결석 안내", desc: "출결 처리와 동시에 학부모에게 상황을 알려 반복 연락을 줄입니다." },
      { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 기준으로 수업 결과 안내를 보냅니다." },
      { title: "질문 응답 흐름", desc: "학생 질문과 강사 답변을 남겨 수업 이후 커뮤니케이션을 정리합니다." },
    ],
  },
  {
    id: "clinic",
    title: "보강·클리닉·후속 조치",
    kicker: "수업 후 조치",
    body: "성적이 낮거나 영상을 보지 않은 학생을 그냥 넘기지 않도록 후속 조치의 근거를 남깁니다.",
    icon: GraduationCap,
    accentBg: "#e7f7fb",
    items: [
      { title: "보강 예약", desc: "보강 일정을 등록하고 학생별 보강 이력을 확인합니다." },
      { title: "클리닉 메모", desc: "상담, 피드백, 약점, 과제 이력을 학생별로 누적합니다." },
      { title: "후속 대상자 판단", desc: "성적, 과제, 영상 시청 상태를 기준으로 다음 조치가 필요한 학생을 찾습니다." },
      { title: "운영 리포트", desc: "선생님이 학부모에게 설명할 수 있는 근거를 화면에 남깁니다." },
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
            <h1 id="features-title">선생님이 처리해야 할 일을 화면별로 모았습니다</h1>
            <p>
              출결, 시험, 영상, 알림톡, 보강이 따로 흩어지면 설명할 일이 늘어납니다.
              학원플러스는 실제 화면을 기준으로 수업 전후 업무를 이어 보여줍니다.
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
                <p>가입, 출결, 시험, 영상 안내를 이벤트 기준으로 발송합니다.</p>
              </article>
              <article>
                <strong>학부모 리포트</strong>
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
              실제 화면
            </span>
            <h2 id="proof-title">말보다 먼저 보여줄 화면</h2>
            <p>
              기능명만 나열하면 와닿지 않습니다. 학생앱, 관리자 화면, 리포트 예시를 먼저 보여주고
              실제 수업에서 어디에 쓰이는지 짧게 붙였습니다.
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
            <h2 id="feature-catalog-title">수업 전후 업무 기준으로 나눴습니다</h2>
            <p>선생님이 읽는 페이지라서 “있습니다”보다 “어떤 일을 줄이는지”를 기준으로 묶었습니다.</p>
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
