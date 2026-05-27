import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  MessageSquareText,
  MousePointer2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import styles from "./ParentTrustPage.module.css";

const REPORT_METRICS = [
  { label: "이번 주 출결", value: "97%", note: "결석 2명 알림톡 발송" },
  { label: "시험 평균", value: "86점", note: "취약 문항 3개 정리" },
  { label: "영상 완료", value: "92%", note: "미시청 5명 재안내" },
  { label: "보강 후보", value: "8명", note: "클리닉 예약 후보" },
];

const REPORT_FLOW = [
  {
    icon: ClipboardCheck,
    title: "수업 근거 수집",
    body: "출결, 시험, 과제, 영상 시청, 보강 기록이 운영 화면에서 자연스럽게 쌓입니다.",
  },
  {
    icon: FileText,
    title: "학부모 리포트 요약",
    body: "이번 주 변화, 취약 단원, 다음 조치를 학부모가 이해하기 쉬운 문장으로 정리합니다.",
  },
  {
    icon: BellRing,
    title: "알림톡 안내",
    body: "수업결과, 영상 확인, 보강 안내를 같은 근거로 보내 반복 설명을 줄입니다.",
  },
  {
    icon: Megaphone,
    title: "상담·홍보 전환",
    body: "적중 리포트와 학교별 내신반 소개 페이지로 상담 전에 신뢰를 먼저 만듭니다.",
  },
];

const USE_CASES = [
  {
    icon: GraduationCap,
    title: "학교별 내신반",
    body: "학교·학년·시험 범위 기준으로 출결, 응시, 취약 문항을 묶어 학부모가 관리 강도를 바로 느끼게 합니다.",
    image: "/promo/landing-daechi-preview-20260527.png",
    alt: "대치동식 수업 소개 랜딩 예시",
  },
  {
    icon: Smartphone,
    title: "영상 복습 관리",
    body: "미시청 학생과 마지막 재생 위치를 리포트에 반영해 “복습을 봤는지” 질문을 자동으로 답하게 합니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어 화면",
  },
  {
    icon: MessageSquareText,
    title: "보강 상담 회수",
    body: "시험 결과와 영상 이력을 근거로 보강 후보를 잡고, 안내 알림톡까지 이어 보강 매출 누수를 줄입니다.",
    image: "/promo/admin-messages.png",
    alt: "관리자 알림톡 운영 화면",
  },
];

const PACKAGES = [
  {
    name: "Standard",
    target: "개인 강사",
    body: "주간 신뢰 리포트 기본 구성과 수업결과 알림톡 흐름을 먼저 세팅합니다.",
  },
  {
    name: "Pro",
    target: "전임 강사·팀 수업",
    body: "학교별 내신반, 영상 미시청 관리, 보강 후보 리포트까지 운영 패키지로 묶습니다.",
  },
  {
    name: "Max",
    target: "여러 반·강사팀",
    body: "학원 브랜드 기준의 리포트 템플릿, 적중 리포트 홍보, 전담 온보딩을 함께 잡습니다.",
  },
];

function HeroReportPreview() {
  return (
    <aside className={styles.reportPreview} aria-label="학부모 신뢰 리포트 예시">
      <div className={styles.reportTop}>
        <div>
          <span>WEEKLY TRUST REPORT</span>
          <strong>대치중2 내신반</strong>
        </div>
        <small>발송 준비</small>
      </div>
      <div className={styles.reportSummary}>
        <ShieldCheck size={22} />
        <p>이번 주 출결은 안정적이고, 함수 단원 오답률이 높아 금요일 클리닉 대상자를 선별했습니다.</p>
      </div>
      <div className={styles.metricGrid}>
        {REPORT_METRICS.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>
      <div className={styles.reportActions}>
        <span>학부모 알림톡</span>
        <strong>이번 주 리포트 발송 대기 42명</strong>
      </div>
    </aside>
  );
}

export default function ParentTrustPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="parent-trust-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>PARENT TRUST OS</span>
            <h1 id="parent-trust-title">학부모 상담 전에 이미 설명이 끝나는 리포트</h1>
            <p>
              대치동 학부모가 원하는 것은 “잘 가르친다”는 주장보다 관리 근거입니다.
              학원플러스는 출결, 성적, 영상, 보강 이력을 한 주 리포트와 알림톡으로 묶어 신뢰를 먼저 만듭니다.
            </p>
            <div className={styles.heroActions}>
              <PhoneInquiryLink className={styles.primaryCta}>전화 문의</PhoneInquiryLink>
              <Link to="/promo/demo" className={styles.secondaryCta}>
                데모 요청
                <MousePointer2 size={18} />
              </Link>
              <Link to="/promo/pricing" className={styles.ghostCta}>
                패키지 요금 보기
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <HeroReportPreview />
        </div>
      </section>

      <section className={styles.flowSection} aria-labelledby="trust-flow-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <BarChart3 size={16} />
              OPERATING DATA TO TRUST
            </span>
            <h2 id="trust-flow-title">운영 데이터가 학부모 신뢰로 바뀌는 네 단계</h2>
            <p>새 기능을 억지로 붙이는 방식이 아니라, 이미 필요한 운영 기록을 구매자가 이해하는 언어로 바꿉니다.</p>
          </header>

          <ol className={styles.flowGrid}>
            {REPORT_FLOW.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={24} />
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={styles.useCaseSection} aria-labelledby="use-case-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <Megaphone size={16} aria-hidden="true" />
              DAECHI-STYLE USE CASES
            </span>
            <h2 id="use-case-title">상품성은 “관리받고 있다”는 느낌에서 나옵니다</h2>
            <p>홍보 문구만 바꾸는 게 아니라, 학부모가 실제로 볼 증거 화면을 앞에 놓는 구성이 핵심입니다.</p>
          </header>

          <div className={styles.useCaseGrid}>
            {USE_CASES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className={styles.useCaseCard}>
                  <figure>
                    <img src={item.image} alt={item.alt} loading="lazy" />
                  </figure>
                  <div>
                    <Icon size={22} />
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <ul>
                      <li>
                        <CheckCircle2 size={15} />
                        학부모가 이해하는 근거로 재정리
                      </li>
                      <li>
                        <CheckCircle2 size={15} />
                        상담·홍보 페이지까지 같은 메시지 유지
                      </li>
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.packageSection} aria-labelledby="package-title">
        <div className={styles.sectionWrap}>
          <div className={styles.packageLayout}>
            <div className={styles.packageCopy}>
              <span>PACKAGE POSITIONING</span>
              <h2 id="package-title">요금제는 기능 묶음이 아니라 학부모 신뢰 운영 수준으로 설명합니다</h2>
              <p>
                같은 기능이라도 “출결 관리”, “영상 관리”로 말하면 약합니다. “이번 주 학부모에게 어떤 근거를 보낼 수 있는가”로
                바꾸면 판매 포인트가 분명해집니다.
              </p>
              <Link to="/promo/pricing" className={styles.darkCta}>
                요금제에서 비교하기
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className={styles.packageStack}>
              {PACKAGES.map((pack) => (
                <article key={pack.name}>
                  <span>{pack.target}</span>
                  <strong>{pack.name}</strong>
                  <p>{pack.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaSection
        title="지금 수업 데이터를 학부모 신뢰 리포트로 바꿔보세요"
        subtitle="현재 운영 중인 출결, 성적, 영상, 보강 흐름을 기준으로 가장 작은 시작 구성을 제안드립니다."
      />
    </div>
  );
}
