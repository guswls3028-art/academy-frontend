import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import CtaSection from "../components/CtaSection";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import { FEATURE_WORKFLOWS, ORDERED_FEATURE_GROUPS, PROOF_CARDS } from "../featureContent";
import styles from "./FeaturesPage.module.css";

const REFERENCES: Record<string, { page?: number; path?: string; label: string; proof?: string; alias?: string }> = {
  "class-management": { page: 33, label: "강의·출결 화면 보기" },
  "exam-score": { page: 23, label: "문항별 채점 화면 보기" },
  "student-video-flow": { page: 10, label: "영상 등록 화면 보기", proof: "student-video", alias: "student-video" },
  communication: { page: 4, label: "알림톡 발송 화면 보기", proof: "alimtalk", alias: "alimtalk" },
  "academy-homepage-flow": { path: "/promo/landing-samples", label: "홈페이지 형식 보기", proof: "academy-homepage", alias: "academy-homepage" },
  clinic: { page: 32, label: "클리닉·재시험 가이드 보기" },
  "matchup-ppt-flow": { path: "/promo/matchup-ppt", label: "PPT·매치업 자세히 보기", proof: "matchup-ppt", alias: "matchup-ppt" },
  "parent-report": { path: "/promo/parent-trust", label: "학부모 상담 활용 보기" },
};

function AlimtalkDetails() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#alimtalk-guide" && detailsRef.current) detailsRef.current.open = true;
  }, [hash]);
  return <details ref={detailsRef} className={styles.details} id="alimtalk-guide">
    <summary>어떤 안내가 자동으로 발송되나요?<ChevronDown size={ICON.sm} aria-hidden="true" /></summary>
    <div className={styles.detailBody}>
      <h3>알림톡 발송 방식</h3>
      <dl className={styles.modes}>
        <div><dt>가입·비밀번호 안내</dt><dd>계정 처리와 함께 자동으로 발송됩니다.</dd></div>
        <div><dt>클리닉·답변 안내</dt><dd>승인 양식과 학원 설정이 준비된 항목만 자동으로 발송됩니다.</dd></div>
        <div><dt>출결·성적·수업 결과</dt><dd>기본은 선생님이 대상과 학생별 최종 문구를 확인한 뒤 직접 발송합니다.</dd></div>
      </dl>
      <h3>직접 발송하는 순서</h3>
      <ol className={styles.steps}>
        <li><strong>대상 확인</strong><p>발송 가능 인원과 연락처 없음·대상 변경으로 제외된 인원을 구분합니다.</p></li>
        <li><strong>학생별 미리보기</strong><p>학생을 선택하면 이름·강의·차시가 들어간 최종 문구를 확인할 수 있습니다.</p></li>
        <li><strong>확인 후 발송</strong><p>대상과 내용을 확인한 뒤 보내고, 실제 성공·실패는 발송 내역에서 확인합니다.</p></li>
      </ol>
      <p className={styles.note}>현재 ‘내 번호로 테스트 받아보기’는 별도 기능으로 제공하지 않습니다.</p>
    </div>
  </details>;
}

export default function FeaturesPage() {
  const { hash } = useLocation();
  return <>
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>기능 소개</h1>
        <p>학생 등록부터 수업, 복습과 학부모 안내까지.<br />필요한 업무를 고르면 기능과 사용 순서를 확인할 수 있습니다.</p>
        <div className={styles.introLinks}><Link to="/promo/features/tour">기능 상세 가이드</Link><Link to="/promo/pricing">요금과 포함 범위</Link></div>
      </header>
      <div className={styles.layout}>
        <nav className={styles.navigation} aria-label="기능 바로가기">
          <span>어떤 업무가 궁금하신가요?</span>
          {ORDERED_FEATURE_GROUPS.map(group => <a key={group.id} href={`#${group.id}`} aria-current={hash === `#${group.id}` || (group.id === "communication" && hash === "#alimtalk-guide") ? "location" : undefined}>{group.title}</a>)}
          <a href="#more-operations">그 밖의 운영 기능</a>
        </nav>
        <div id="feature-catalog-title" className={styles.catalog}>
          <h2 className={styles.catalogTitle}>전체 기능 목록</h2>
          {ORDERED_FEATURE_GROUPS.map(group => {
            const reference = REFERENCES[group.id];
            const proof = PROOF_CARDS.find(item => item.id === reference.proof);
            return <section key={group.id} id={group.id} className={styles.group} aria-labelledby={`${group.id}-title`}>
              {reference.alias && <span id={reference.alias} className={styles.anchor} />}
              <h2 id={`${group.id}-title`}>{group.title}</h2>
              <p className={styles.description}>{group.body}</p>
              <dl className={styles.functions}>{group.items.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.desc}</dd></div>)}</dl>
              {group.id === "exam-score" && <p className={styles.note}>자동채점은 객관식·OX형과 일부 수학 단답형(0~999 정수)을 지원합니다. 서술형은 선생님이 직접 채점합니다.</p>}
              {group.id === "communication" ? <AlimtalkDetails /> : <details className={styles.details}>
                <summary>사용 순서 보기<ChevronDown size={ICON.sm} aria-hidden="true" /></summary>
                <ol className={styles.steps} aria-label={`${group.title} 사용 흐름`}>{FEATURE_WORKFLOWS[group.id].map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.desc}</p></li>)}</ol>
              </details>}
              {proof && <details className={styles.details}>
                <summary>실제 화면 보기<ChevronDown size={ICON.sm} aria-hidden="true" /></summary>
                <div className={styles.detailBody}>
                  <p>{proof.body}</p>
                  <div className={styles.screens} data-phone={proof.phone || undefined}>
                    <PromoEvidenceImage src={proof.image} alt={proof.alt} width={proof.imageWidth} height={proof.imageHeight} loading="lazy" />
                    {proof.secondaryVisual && <PromoEvidenceImage src={proof.secondaryVisual.image} alt={proof.secondaryVisual.alt} width={proof.secondaryVisual.width} height={proof.secondaryVisual.height} loading="lazy" />}
                  </div>
                  <ul>{proof.points.map(point => <li key={point}>{point}</li>)}</ul>
                  <Link to={proof.ctaPath}>{proof.ctaLabel}</Link>
                </div>
              </details>}
              <Link className={styles.reference} to={reference.path ?? `/promo/features/tour?guideBook=detail&guidePage=${reference.page}`}>{reference.label}</Link>
            </section>;
          })}
          <section id="more-operations" className={styles.group} aria-labelledby="more-operations-title">
            <h2 id="more-operations-title">그 밖의 운영 기능</h2>
            <p className={styles.description}>수납 기록, 직원·강사 업무, 질문과 자료 공유도 전체 사용 가이드에서 찾아볼 수 있습니다.</p>
            <div className={styles.moreLinks}><Link to="/promo/guide?role=admin&q=수납">수납 기록 관리</Link><Link to="/promo/guide?role=teacher">직원·강사 사용 방법</Link><Link to="/promo/features/tour?guideBook=detail&guidePage=39">질문·상담·자료 공유</Link></div>
            <p className={styles.note}>원비·교재비 온라인 결제는 현재 지원하지 않습니다. 수납 기록 관리와는 별도 기능입니다.</p>
          </section>
          <div className={styles.next}><h2>다음으로 확인할 내용</h2><Link to="/promo/pricing">월 요금과 별도 비용</Link><Link to="/promo/faq">도입 전 자주 묻는 질문</Link><Link to="/promo/guide">전체 사용 방법과 문제 해결</Link></div>
        </div>
      </div>
    </div>
    <CtaSection title="궁금한 기능이 남아 있나요?" subtitle="확인하고 싶은 기능이나 현재 쓰는 관리 방식을 알려주세요." secondaryPath="/promo/contact" secondaryLabel="문의하기" />
  </>;
}
