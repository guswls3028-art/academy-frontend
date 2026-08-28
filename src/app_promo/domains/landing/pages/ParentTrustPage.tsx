import { Link } from "react-router";
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
  Smartphone,
} from "lucide-react";
import { CONSULT_PHONE_DISPLAY } from "../business";
import CtaSection from "../components/CtaSection";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./ParentTrustPage.module.css";

const REPORT_FLOW = [
  {
    icon: ClipboardCheck,
    title: "수업 기록 남기기",
    body: "출결, 시험, 과제, 영상 시청, 보강 기록이 수업 화면에 쌓입니다.",
  },
  {
    icon: FileText,
    title: "안내할 기록 확인하기",
    body: "성적, 미시청 영상, 보강 이력 중 이번 상담에 필요한 내용만 선생님이 확인합니다.",
  },
  {
    icon: BellRing,
    title: "선생님 메모 작성·검수",
    body: "승인된 알림톡 양식 안에 선생님 메모를 적고, 대상과 내용을 발송 전에 확인합니다.",
  },
  {
    icon: Megaphone,
    title: "알림톡 또는 상담에 활용",
    body: "확정한 내용은 알림톡으로 보내거나 상담 화면을 보며 학부모에게 설명합니다.",
  },
];

const USE_CASES = [
  {
    icon: GraduationCap,
    title: "유사 문항 상담 자료",
    body: "실제 시험과 시험 전에 다룬 자료를 비교해 학원이 확인한 유사 문항을 상담 자료로 활용합니다.",
    image: "/promo/matchup-actual-vs-prepared-q1-20260726.jpg",
    alt: "실제 시험과 사전 대비 자료를 비교한 적중 보고서 예시",
    imageWidth: 1263,
    imageHeight: 893,
  },
  {
    icon: Smartphone,
    title: "영상 복습 관리",
    body: "누가 영상을 안 봤는지, 어디까지 봤는지를 확인해 복습 안내와 상담 근거로 활용합니다.",
    image: "/promo/student-video-player.webp",
    alt: "학생전용앱 영상 플레이어 화면",
    imageWidth: 780,
    imageHeight: 1688,
  },
  {
    icon: MessageSquareText,
    title: "보강 상담 회수",
    body: "시험 결과와 영상 이력을 보고 보강이 필요한 학생을 찾고, 내용을 확인한 뒤 알림톡으로 안내합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 운영 화면",
    imageWidth: 1440,
    imageHeight: 820,
  },
];

const PACKAGES = [
  {
    name: "기본 요금제",
    target: "2026년 8월 가입 · 월 14만 5천원",
    body: "9월 이후 가입 요금은 월 18만원이며 두 금액 모두 부가세 10% 별도입니다. 안내된 기능을 모두 포함하며 알림톡, 추가 저장공간 등 별도 비용은 요금 안내에서 확인할 수 있습니다.",
  },
];

function HeroReportPreview() {
  return (
    <aside className={styles.reportPreview} aria-label="학원 운영 현황 실제 화면">
      <div className={styles.reportTop}>
        <div>
          <span>수업·시험 운영 현황</span>
          <strong>시험·제출·문의 확인</strong>
        </div>
          <small>실제 화면 · 예시 자료</small>
      </div>
      <figure className={styles.reportScreen}>
        <PromoEvidenceImage
          src="/promo/admin-scores-authority-20260726.png"
          alt="예시 학생 세 명의 시험별 점수와 판정 결과를 확인하는 학원플러스 관리자 성적 화면"
          width={1440}
          height={900}
        />
      </figure>
      <div className={styles.reportActions}>
        <span>기록을 확인한 다음</span>
        <strong>선생님이 안내 내용과 대상을 최종 확정합니다</strong>
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
            <span className={styles.eyebrow}>학부모 상담 자료</span>
            <h1 id="parent-trust-title">수업 기록을 확인하며 학부모 상담을 준비합니다</h1>
            <p>
              출결, 성적, 영상, 보강 기록을 화면에서 확인하고 상담에 필요한 내용만 골라 설명하세요.
              알림톡은 선생님이 내용과 대상을 확인한 뒤 보냅니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryCta}>
                내 학원 화면 요청
                <MousePointer2 size={18} />
              </Link>
              <Link to="/promo/features" className={styles.ghostCta}>
                실제 화면 보기
                <ArrowRight size={18} />
              </Link>
            </div>
            <p className={styles.heroPhone}>
              전화 상담 <PhoneInquiryLink>{CONSULT_PHONE_DISPLAY}</PhoneInquiryLink>
            </p>
          </div>

          <HeroReportPreview />
        </div>
      </section>

      <section className={styles.flowSection} aria-labelledby="trust-flow-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <BarChart3 size={16} />
              수업 기록에서 안내까지
            </span>
            <h2 id="trust-flow-title">이미 남긴 기록을 확인하고, 선생님 말로 안내합니다</h2>
            <p>저장된 수업 기록을 확인하고, 상담에 필요한 내용과 안내 대상을 선생님이 정합니다.</p>
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
              활용 예시
            </span>
            <h2 id="use-case-title">기록을 함께 보면 상담이 편해집니다</h2>
            <p>기억에 기대지 않고, 학부모가 궁금해하는 출결·성적·영상·보강 화면을 보며 설명합니다.</p>
          </header>

          <div className={styles.useCaseGrid}>
            {USE_CASES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className={styles.useCaseCard}>
                  <figure>
                    <PromoEvidenceImage
                      src={item.image}
                      alt={item.alt}
                      width={item.imageWidth}
                      height={item.imageHeight}
                      loading="lazy"
                    />
                  </figure>
                  <div>
                    <Icon size={22} />
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <ul>
                      <li>
                        <CheckCircle2 size={15} />
                        실제 기록에서 안내할 내용 고르기
                      </li>
                      <li>
                        <CheckCircle2 size={15} />
                        선생님이 대상과 내용 최종 확인
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
              <span>요금 기준</span>
              <h2 id="package-title">한 가지 요금으로 안내된 기능을 모두 이용합니다</h2>
              <p>
                계정이나 수강생 수에 따른 추가 요금은 없습니다. 현재 관리 방식에 맞춰
                필요한 기능과 시작 순서를 정합니다.
              </p>
              <Link to="/promo/pricing" className={styles.darkCta}>
                요금 확인하기
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
        title="현재 남기고 있는 수업 기록부터 함께 확인해보세요"
        subtitle="출결, 성적, 영상, 보강을 어떻게 관리하는지 듣고 상담에 필요한 화면을 보여드립니다."
      />
    </div>
  );
}
