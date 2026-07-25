// PATH: src/app_promo/domains/landing/business.ts

const CONSULT_PHONE_PARTS = ["010", "3121", "7466"] as const;

export const CONSULT_PHONE_LABEL = "전화 문의";
export const AUGUST_PROMOTION_LABEL = "2026년 8월 가입 특별가";
export const AUGUST_PRICE_GUARANTEE =
  "8월 1일부터 31일까지 가입한 학원은 이후 가격이 인상되어도 월 159,000원을 그대로 적용합니다.";

export function getConsultPhoneTelHref() {
  return `tel:${CONSULT_PHONE_PARTS.join("")}`;
}

export const PRICE_POLICY_NOTES = [
  "월 공급가 145,000원, 부가가치세 14,000원, 월 결제 총액 159,000원입니다.",
  AUGUST_PRICE_GUARANTEE,
  "8월 이후 신규 가입 가격은 인상될 예정이며, 8월 가입 학원에는 해당 인상을 적용하지 않습니다.",
  "수강생 수나 계정 수에 따라 기능을 나누지 않고 모든 기능을 제공합니다.",
  "기본 저장공간은 200GB입니다. 추가 저장공간이 필요하면 별도 협의합니다.",
  "알림톡 발송비, 저장공간 초과, 대량 데이터 이전, 커스텀 개발은 별도 협의입니다.",
];

export interface PromoPlanDef {
  name: string;
  key: string;
  monthlySupplyAmount: number;
  monthlyTaxAmount: number;
  monthlyTotalAmount: number;
  target: string;
  positioning: string;
  verdict: string;
  studentLimit: string;
  adminLimit: string;
  storage: string;
  popular?: boolean;
  features: string[];
  cta: string;
  ctaLink: string;
  ctaKind?: "phone";
}

export const PROMO_PLANS: PromoPlanDef[] = [
  {
    name: "전체 기능",
    key: "all",
    monthlySupplyAmount: 145000,
    monthlyTaxAmount: 14000,
    monthlyTotalAmount: 159000,
    target: "2026년 8월 1일~31일 가입 학원",
    positioning: "8월 가입자 평생 가격 보장",
    verdict: "추후 신규 가입 가격이 올라도 월 159,000원 그대로",
    studentLimit: "제한 없음",
    adminLimit: "제한 없음",
    storage: "200GB 포함",
    popular: true,
    features: [
      "학생·강의·수업·출결 관리",
      "시험·과제·성적 분석",
      "AI 자동채점과 서술형 보조 평가",
      "학부모 상담 자료와 알림톡 연동",
      "보강·클리닉 운영",
      "학생앱 영상 복습과 시청 이력",
      "매치업·적중 리포트·공개 소개 페이지",
      "강사·스태프 권한 관리",
      "저장공간 200GB와 도입 지원",
    ],
    cta: "내 자료로 데모 요청",
    ctaLink: "/promo/demo",
  },
];

export function formatWon(value: number) {
  return value.toLocaleString("ko-KR");
}
