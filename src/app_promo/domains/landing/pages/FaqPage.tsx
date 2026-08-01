import { Link } from "react-router";
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
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./PromoPages.module.css";

const FAQS = [
  {
    q: "학생전용앱에서 실제로 영상을 볼 수 있나요?",
    a: "네. 수강생은 학생전용앱에서 강의별 영상 목록을 보고, 마지막으로 보던 지점부터 이어볼 수 있습니다. 플레이어, 댓글, 좋아요, 재생 목록이 앱 안에 있어 외부 링크를 따로 설명하지 않아도 됩니다.",
  },
  {
    q: "선생님은 영상 시청 여부를 확인할 수 있나요?",
    a: "네. 수강생별 미시청, 시청중, 완료 상태와 마지막 재생 위치를 확인할 수 있습니다. 미시청 학생에게는 영상 확인 안내를 알림톡으로 보낼 수 있습니다.",
  },
  {
    q: "어떤 알림톡이 자동 또는 수동으로 발송되나요?",
    a: "학생·학부모 가입과 비밀번호 변경 안내는 계정 처리와 함께 자동 발송됩니다. 클리닉 예약·변경·입실과 질문 답변 등은 승인 양식과 학원 설정이 준비된 항목만 자동 발송합니다. 출결·성적·수업 결과·과제 안내는 기본적으로 대상과 학생별 최종 문구를 확인한 뒤 직접 발송합니다.",
  },
  {
    q: "발송 전에 학생별 알림톡 문구를 볼 수 있나요?",
    a: "네. 발송 가능 인원과 제외 대상을 먼저 확인하고, 학생을 선택하면 이름·강의·차시가 들어간 최종 문구를 카카오톡 형태로 미리 볼 수 있습니다. 대상과 내용을 확인한 뒤 발송하며, 실제 성공·실패는 발송 내역에서 확인합니다. 현재 내 번호로 테스트 받아보기는 별도 기능으로 제공하지 않습니다.",
  },
  {
    q: "수업결과나 성적도 알림톡으로 보낼 수 있나요?",
    a: "가능합니다. 저장된 성적, 피드백, 수업 결과로 안내 템플릿을 만들고, 선생님이 확인한 내용만 발송하는 방식을 권장합니다.",
  },
  {
    q: "자동채점은 어떤 유형의 문제를 지원하나요?",
    a: "객관식, OX형과 일부 수학 단답형(정답이 0~999 정수인 문항)을 자동으로 채점합니다. 서술형은 선생님이 직접 답안을 확인하고 점수를 입력합니다.",
  },
  {
    q: "서술형도 완전 자동으로 채점되나요?",
    a: "아닙니다. 현재 서술형은 자동채점하지 않으며, 선생님이 답안을 직접 확인하고 점수를 확정합니다.",
  },
  {
    q: "가격과 포함 기능은 어떻게 되나요?",
    a: "2026년 8월 1일부터 31일까지 가입한 학원은 월 14만 5천원(부가세 10% 별도, 결제금액 15만 9,500원)이며, 해당 공급가는 서비스를 이용하는 동안 유지됩니다. 9월 이후 가입 요금은 월 18만원(부가세 10% 별도, 결제금액 19만 8천원)입니다. 기본 저장공간은 200GB이며 알림톡 발송비, 저장공간 초과, 대량 이전, 맞춤 개발은 별도 협의합니다.",
  },
  {
    q: "기존 영상이나 수강생 자료를 이전할 수 있나요?",
    a: "기존 영상 파일을 올릴 수 있고, CSV나 엑셀 파일로 수강생을 한꺼번에 등록할 수 있습니다. 자료가 많으면 분량과 일정에 따라 이전 방법을 상담에서 확인합니다.",
  },
  {
    q: "강사나 스태프 권한을 나눌 수 있나요?",
    a: "네. 대표 강사, 보조강사, 스태프처럼 역할별 권한을 나눌 수 있습니다. 개인 강사는 단일 계정으로 시작하고, 팀 수업으로 확장할 때 계정을 추가하면 됩니다.",
  },
  {
    q: "데모 요청 후에는 어떻게 진행되나요?",
    a: "데모 요청을 받으면 현재 수업 방식, 학생 수, 영상 사용 여부, 알림톡 필요 범위를 먼저 확인합니다. 이후 실제 화면 시연, 가격과 일정 상담, 계정 설정 순서로 진행됩니다.",
  },
];

const QUICK_CHECKS = [
  { icon: PlayCircle, text: "학생앱 영상은 실제 화면으로 확인" },
  { icon: BellRing, text: "알림톡은 자동·직접 발송 범위와 학생별 미리보기 확인" },
  { icon: ReceiptText, text: "8월 가입 월 14만 5천원 · 9월 이후 월 18만원 · 부가세 10% 별도" },
  { icon: ShieldCheck, text: "서술형은 선생님이 직접 채점" },
];

export default function FaqPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroFaq}`} aria-labelledby="faq-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>자주 묻는 질문</span>
            <h1 id="faq-title">사용하기 전에 확인할 질문을 모았습니다</h1>
            <p>
              영상 시청 기록, 알림톡 발송 범위, 자동채점과 요금 기준을 정리했습니다.
              필요한 내용이 정해져 있으면 전화로도 확인할 수 있습니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/features#student-video-flow" className={styles.primaryCta}>
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
              <PromoEvidenceImage
                src="/promo/admin-alimtalk-auto-send.png"
                alt="관리자 알림톡 발송 설정 화면"
                width={1440}
                height={820}
              />
              <figcaption className={styles.heroScreenCaption}>
                <strong>알림톡 발송 설정</strong>
                <span>승인 양식 · 자동/수동 상태 · 발송 시점</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <strong>학생앱 영상</strong>
                <p>학생이 실제로 앱에서 보는 화면을 먼저 보여줍니다.</p>
              </article>
              <article>
                <strong>요금 기준</strong>
                <p>월 구독료와 별도 비용을 나눠 상담 전에 오해를 줄입니다.</p>
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
                확인 기준
              </span>
              <h2 id="faq-list-title">상담 전에 확인할 내용</h2>
              <p>요금, 알림톡 발송 범위와 실제 학생 화면을 미리 확인하실 수 있습니다.</p>
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
              <PromoEvidenceImage
                src="/promo/student-video-course.webp"
                alt="학생전용앱에서 강의의 차시와 영상 수를 확인하는 화면"
                width={780}
                height={1688}
                loading="lazy"
              />
            </div>
            <div className={styles.proofText}>
              <span className={styles.proofBadge}>
                <CheckCircle2 size={15} />
                학생앱 화면
              </span>
              <h3 id="faq-proof-title">학생앱에서 강의와 차시를 확인하는 화면입니다</h3>
              <p>학생은 수강 중인 강의를 고르고, 차시별 영상 목록으로 이동합니다.</p>
              <Link to="/promo/video-platform" className={styles.textButton}>
                학생앱 영상 자세히 보기
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <CtaSection
        title="더 궁금한 점이 있으신가요?"
        subtitle="문의 양식 또는 전화로 필요한 내용을 확인합니다."
      />
    </div>
  );
}
