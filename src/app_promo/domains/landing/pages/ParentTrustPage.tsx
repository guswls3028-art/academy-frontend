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
  { label: "시험 평균", value: "86점", note: "취약 문항 3개 확인" },
  { label: "영상 완료", value: "92%", note: "미시청 5명 재안내" },
  { label: "보강 후보", value: "8명", note: "클리닉 예약 후보" },
];

const REPORT_FLOW = [
  {
    icon: ClipboardCheck,
    title: "수업 기록 남기기",
    body: "출결, 시험, 과제, 영상 시청, 보강 기록이 수업 화면에 쌓입니다.",
  },
  {
    icon: FileText,
    title: "학부모 리포트 요약",
    body: "이번 주 변화, 취약 단원, 다음에 챙길 일을 짧은 문장으로 보여줍니다.",
  },
  {
    icon: BellRing,
    title: "알림톡 안내",
    body: "수업 결과, 영상 확인, 보강 안내를 학부모에게 바로 보냅니다.",
  },
  {
    icon: Megaphone,
    title: "상담·홍보 자료",
    body: "적중 리포트와 학교별 내신반 소개 페이지에 같은 자료를 활용합니다.",
  },
];

const USE_CASES = [
  {
    icon: GraduationCap,
    title: "학교별 내신반",
    body: "학교, 학년, 시험 범위에 맞춰 출결, 응시, 취약 문항을 보여주면 관리가 어떻게 되는지 바로 보입니다.",
    image: "/promo/landing-daechi-preview-20260527.png",
    alt: "학교별 수업 소개 페이지 예시",
  },
  {
    icon: Smartphone,
    title: "영상 복습 관리",
    body: "누가 영상을 안 봤는지, 어디까지 봤는지를 리포트에 담아 복습 확인 질문에 바로 답할 수 있습니다.",
    image: "/promo/student-video-player.png",
    alt: "학생전용앱 영상 플레이어 화면",
  },
  {
    icon: MessageSquareText,
    title: "보강 상담 회수",
    body: "시험 결과와 영상 이력을 보고 보강이 필요한 학생을 찾고, 안내 알림톡까지 보냅니다.",
    image: "/promo/admin-messages.png",
    alt: "관리자 알림톡 운영 화면",
  },
];

const PACKAGES = [
  {
    name: "Standard",
    target: "개인 강사",
    body: "주간 학부모 리포트와 수업 결과 알림톡부터 세팅합니다.",
  },
  {
    name: "Pro",
    target: "전임 강사·팀 수업",
    body: "학교별 내신반, 영상 미시청 관리, 보강 후보 리포트까지 함께 씁니다.",
  },
  {
    name: "Max",
    target: "여러 반·강사팀",
    body: "학원 브랜드에 맞춘 리포트 템플릿, 적중 리포트, 전담 온보딩을 제공합니다.",
  },
];

function HeroReportPreview() {
  return (
    <aside className={styles.reportPreview} aria-label="학부모 리포트 예시">
      <div className={styles.reportTop}>
        <div>
          <span>주간 관리 리포트</span>
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
            <span className={styles.eyebrow}>상담 전 설명 자료</span>
            <h1 id="parent-trust-title">상담 전에 보낼 수 있는 주간 관리 리포트</h1>
            <p>
              학부모는 “이번 주에 뭘 챙겨줬는지”를 알고 싶어 합니다.
              출결, 성적, 영상, 보강 내역을 한 주 리포트와 알림톡으로 보여주세요.
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
              수업 기록에서 안내까지
            </span>
            <h2 id="trust-flow-title">이미 남긴 기록으로 이번 주 안내를 만듭니다</h2>
            <p>새 일을 억지로 늘리지 않고, 수업 중에 남긴 기록을 학부모가 이해할 말로 바꿉니다.</p>
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
            <h2 id="use-case-title">보여줄 자료가 있어야 상담이 짧아집니다</h2>
            <p>홍보 문구만 바꾸지 않고, 학부모가 실제로 볼 기록과 화면을 앞에 둡니다.</p>
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
                        학부모가 이해할 말로 다시 쓰기
                      </li>
                      <li>
                        <CheckCircle2 size={15} />
                        상담·홍보 페이지에도 같은 내용 활용
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
              <h2 id="package-title">수강생 규모와 필요한 범위에 맞춰 고릅니다</h2>
              <p>
                혼자 쓰는 수업과 여러 반이 함께 쓰는 수업은 필요한 계정, 저장공간, 지원 범위가 다릅니다.
                지금 쓰는 방식에 맞춰 시작 범위를 정합니다.
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
        title="지금 남기고 있는 수업 기록부터 리포트로 만들어보세요"
        subtitle="출결, 성적, 영상, 보강을 어떻게 관리하는지 듣고 시작 범위를 정해드립니다."
      />
    </div>
  );
}
