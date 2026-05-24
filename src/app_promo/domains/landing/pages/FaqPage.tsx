import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  PlayCircle,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import CtaSection from "../components/CtaSection";
import styles from "./PromoPages.module.css";

const FAQS = [
  {
    q: "학생전용앱에서 실제로 영상을 볼 수 있나요?",
    a: "네. 수강생은 학생전용앱에서 강의별 영상 목록을 보고, 마지막으로 보던 지점부터 이어볼 수 있습니다. 플레이어, 댓글, 좋아요, 재생 목록이 앱 안에 들어가 있어 외부 링크를 따로 안내하는 방식보다 설명이 쉽습니다.",
  },
  {
    q: "강사님은 영상 시청 여부를 확인할 수 있나요?",
    a: "네. 수강생별 미시청, 시청중, 완료 상태와 마지막 재생 위치를 기준으로 후속 지도를 잡을 수 있습니다. 미시청 학생에게는 영상 확인 안내를 알림톡 흐름으로 연결할 수 있습니다.",
  },
  {
    q: "알림톡 자동발송은 어떤 상황에서 동작하나요?",
    a: "가입·등록, 출결, 시험, 과제, 클리닉, 결제, 커뮤니티, 직원 관련 이벤트처럼 반복되는 운영 상황을 기준으로 자동발송을 설정합니다. 실제 발송 범위는 승인 템플릿, 카카오 알림톡 정책, 학원별 설정에 맞춰 상담 시 확정합니다.",
  },
  {
    q: "수업결과나 성적도 알림톡으로 보낼 수 있나요?",
    a: "가능한 흐름으로 설계되어 있습니다. 저장된 성적, 피드백, 수업 결과를 기준으로 안내 템플릿을 구성하고, 강사님이 검수한 내용만 발송하는 방식으로 운영하는 것을 권장합니다.",
  },
  {
    q: "AI 자동채점은 어떤 유형의 문제를 지원하나요?",
    a: "객관식, OX형, 단답형처럼 정답 기준이 분명한 문항은 자동 판정을 지원합니다. 서술형은 AI가 초안 점수와 근거를 제안하고, 강사님이 최종 검수하는 구조입니다.",
  },
  {
    q: "서술형도 완전 자동으로 채점되나요?",
    a: "아닙니다. 성적은 민감하기 때문에 서술형은 완전 자동 확정보다 ‘AI 보조 평가 + 강사 검수’를 기본 구조로 설명하는 것이 맞습니다. 최종 점수 확정 권한은 강사님에게 있습니다.",
  },
  {
    q: "가격은 어떻게 구분되나요?",
    a: "Standard 99,000원/월, Pro 198,000원/월, Max 330,000원/월 기준입니다. 부가세는 별도이며 문자, SMS, 알림톡 발송비와 대량 이전, 커스텀 개발은 별도 협의입니다.",
  },
  {
    q: "기존 영상이나 수강생 자료를 이전할 수 있나요?",
    a: "기존 영상 파일 업로드와 CSV, Excel 기반 수강생 일괄 등록을 지원합니다. 대량 이전이 필요한 경우 자료량과 일정에 따라 지원 범위를 상담에서 확인합니다.",
  },
  {
    q: "강사나 스태프 권한을 나눌 수 있나요?",
    a: "네. 대표 강사, 보조강사, 스태프처럼 역할별 권한을 나눌 수 있습니다. 개인 강사는 단일 계정으로 시작하고, 팀 수업으로 확장할 때 계정을 추가하면 됩니다.",
  },
  {
    q: "데모 요청 후에는 어떻게 진행되나요?",
    a: "데모 요청 접수 후 현재 수업 방식, 학생 수, 영상 운영 여부, 알림톡 필요 범위를 먼저 확인합니다. 이후 맞춤 시연, 가격과 일정 상담, 계정 설정 순서로 진행됩니다.",
  },
];

const QUICK_CHECKS = [
  { icon: PlayCircle, text: "학생앱 영상은 실제 화면으로 확인" },
  { icon: BellRing, text: "알림톡은 승인 템플릿과 발송비 별도 확인" },
  { icon: ReceiptText, text: "월 구독료는 부가세 별도 기준" },
  { icon: ShieldCheck, text: "AI 채점 최종 확정은 강사님 권한" },
];

export default function FaqPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroFaq}`} aria-labelledby="faq-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>FAQ FOR TEACHERS</span>
            <h1 id="faq-title">강사님이 계약 전에 바로 확인해야 할 질문</h1>
            <p>
              홍보 문구가 과해 보이지 않도록 영상, 알림톡, AI 채점, 가격 기준을 명확히 나눴습니다.
              실제 상담은 전화 문의 버튼으로 바로 연결됩니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/features#student-video" className={styles.primaryCta}>
                학생앱 영상 화면 보기
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/pricing" className={styles.secondaryCta}>
                가격표 확인
              </Link>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="자주 묻는 핵심 화면">
            <figure className={styles.heroScreen}>
              <img src="/promo/admin-alimtalk-auto-send.png" alt="관리자 알림톡 자동발송 설정 화면" />
              <figcaption className={styles.heroScreenCaption}>
                <strong>알림톡 자동발송</strong>
                <span>운영 이벤트 · 템플릿 · 발송 시점</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <strong>학생앱 영상</strong>
                <p>학생이 실제로 앱에서 보는 화면을 기능 설명의 앞쪽에 둡니다.</p>
              </article>
              <article>
                <strong>요금 기준</strong>
                <p>월 구독료와 별도 비용을 분리해 상담 전에 오해를 줄입니다.</p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.faqSection} aria-labelledby="faq-list-title">
        <div className={styles.sectionWrap}>
          <div className={styles.faqShell}>
            <aside className={styles.faqRail}>
              <span>
                <MessageCircle size={16} />
                QUICK CHECK
              </span>
              <h2 id="faq-list-title">상담 전에 꼭 짚을 기준</h2>
              <p>강사님이 읽는 페이지라서 과장보다 확인 가능한 기준을 앞에 두었습니다.</p>
              <ul className={styles.faqQuickList}>
                {QUICK_CHECKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text}>
                      <Icon size={16} />
                      {item.text}
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className={styles.faqList}>
              {FAQS.map((item, index) => (
                <details key={item.q} className={styles.faqItem} open={index < 2 ? true : undefined}>
                  <summary>
                    {item.q}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="faq-proof-title">
        <div className={styles.sectionWrap}>
          <article className={`${styles.proofCard} ${styles.proofCardFeatured}`} data-tone="video">
            <div className={`${styles.proofVisual} ${styles.proofPhoneVisual}`}>
              <img src="/promo/student-video-player.png" alt="학생전용앱 영상 플레이어 화면" loading="lazy" />
            </div>
            <div className={styles.proofText}>
              <span className={styles.proofBadge}>
                <CheckCircle2 size={15} />
                핵심 증거
              </span>
              <h3 id="faq-proof-title">영상 기능은 FAQ에서도 숨기지 않고 크게 보여줍니다</h3>
              <p>
                선생님들이 좋아할 기능은 화면이 먼저 보여야 합니다. FAQ에서도 학생이 실제로 보는 앱 화면을
                다시 보여주어 “학생도 쓸 수 있는 기능”이라는 인상을 남깁니다.
              </p>
              <Link to="/promo/video-platform" className={styles.textButton}>
                영상 플랫폼 상세 보기
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <CtaSection
        title="더 궁금한 점이 있으신가요?"
        subtitle="문의 폼 또는 전화 문의로 바로 확인해드립니다."
      />
    </div>
  );
}
