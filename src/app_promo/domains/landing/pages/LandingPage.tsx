import { Link } from "react-router";
import { ArrowRight, BellRing, BookOpenCheck, ClipboardCheck, Globe2, PlayCircle, Presentation, UsersRound } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { PLANNED_PAYMENT_NOTICE, START_GUIDANCE_NOTICE } from "../business";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import CtaSection from "../components/CtaSection";
import styles from "./LandingPage.module.css";

const FEATURES = [
  { id: "students", icon: UsersRound, title: "학생·수업 관리", copy: "학생 명부, 강의와 차시, 출결 기록을 관리합니다.", href: "/promo/features#class-management" },
  { id: "scores", icon: ClipboardCheck, title: "시험·성적", copy: "문항별 정오를 입력하고 학생별 성적과 오답을 확인합니다.", href: "/promo/features#exam-score" },
  { id: "video", icon: PlayCircle, title: "수업 영상", copy: "수업 영상을 공유하고 학생의 시청 진도를 확인합니다.", href: "/promo/video-platform" },
  { id: "alimtalk", icon: BellRing, title: "알림톡", copy: "학생별 안내문을 미리 확인한 뒤 보내고, 발송 결과를 조회합니다.", href: "/promo/features#alimtalk-guide" },
  { id: "tools", icon: Presentation, title: "칠판용 PPT · 매치업", copy: "수업 자료를 PPT로 만들고, 시험 문항과 학원 자료를 비교합니다.", href: "/promo/matchup-ppt" },
  { id: "website", icon: Globe2, title: "학원 홈페이지", copy: "학원 소개, 수업 안내, 후기와 공개 자료를 직접 관리합니다.", href: "/promo/landing-samples" },
] as const;

function ProductPreview() {
  return (
    <figure className={styles.productPreview} data-testid="promo-real-product-showcase">
      <div className={styles.productScreens}>
        <div className={styles.desktopScreen}>
          <PromoEvidenceImage src="/promo/admin-attendance-realuse-20260828.png"
            alt="여덟 명의 합성 학생 출결 상태를 확인하는 학원플러스 관리자 PC 화면"
            width={1440} height={900} loading="eager" />
          <span>관리자 화면</span>
        </div>
        <div className={styles.mobileScreen}>
          <PromoEvidenceImage src="/promo/student-operations-realuse-20260828.png"
            alt="오늘 수업과 다음 일정을 확인하는 학원플러스 학생 모바일 화면"
            width={780} height={1688} loading="eager" />
          <span>학생 앱</span>
        </div>
      </div>
      <figcaption>실제 프로그램 화면 · 개인정보가 없는 예시 데이터</figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="promo-hero-title">
        <div className={styles.heroCopy}>
          <h1 id="promo-hero-title">수업 관리부터<br />학생의 복습까지</h1>
          <p>출결과 성적을 기록하고, 수업 영상을 공유하며,<br className={styles.desktopBreak} /> 학생과 학부모에게 필요한 안내를 보냅니다.</p>
          <div className={styles.actions}>
            <a href="#core-system" className={styles.primaryLink}>기능 살펴보기 <ArrowRight size={ICON.sm} aria-hidden="true" /></a>
            <Link to="/promo/features/tour" className={styles.secondaryLink}>기능 상세 가이드</Link>
          </div>
        </div>
        <ProductPreview />
      </section>
      <section id="core-system" className={styles.features} aria-labelledby="features-title">
        <header className={styles.sectionHeading}>
          <h2 id="features-title">주요 기능</h2>
          <Link to="/promo/features">전체 기능 보기 <ArrowRight size={ICON.sm} aria-hidden="true" /></Link>
        </header>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.id} to={feature.href} className={styles.feature} data-workflow-card={feature.id}>
                <Icon size={ICON.lg} aria-hidden="true" />
                <div><h3>{feature.title}</h3><p>{feature.copy}</p></div>
                <ArrowRight className={styles.featureArrow} size={ICON.sm} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
      <section className={styles.guide} aria-labelledby="feature-guide-title">
        <BookOpenCheck size={32} aria-hidden="true" />
        <div>
          <h2 id="feature-guide-title">화면으로 보는 기능 상세 가이드</h2>
          <p>알림톡, 수업 영상, 엑셀 업로드, 문항별 채점을<br className={styles.desktopBreak} /> 실제 화면과 사용 순서로 정리했습니다.</p>
          <div className={styles.guideLinks}>
            <Link to="/promo/features/tour">5쪽 요약 보기 <ArrowRight size={ICON.sm} aria-hidden="true" /></Link>
            <Link to="/promo/features/tour?guideBook=detail&guidePage=1">43쪽 상세 가이드 보기 <ArrowRight size={ICON.sm} aria-hidden="true" /></Link>
          </div>
          <Link to="/promo/guide" className={styles.roleGuide}>전체 사용 가이드 보기</Link>
        </div>
      </section>
      <section className={styles.start} aria-labelledby="start-title">
        <h2 id="start-title">이용 안내</h2>
        <div>
          <p>{START_GUIDANCE_NOTICE}</p>
          <Link to="/promo/pricing">요금과 이용 조건 보기 <ArrowRight size={ICON.sm} aria-hidden="true" /></Link>
          <p className={styles.plannedNote}>{PLANNED_PAYMENT_NOTICE}</p>
        </div>
      </section>
      <CtaSection />
    </div>
  );
}
