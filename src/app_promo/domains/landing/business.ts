// PATH: src/app_promo/domains/landing/business.ts

const CONSULT_PHONE_PARTS = ["010", "3121", "7466"] as const;

export const INSTAGRAM_URL = "https://www.instagram.com/hakwon_p/";
export const INSTAGRAM_HANDLE = "@hakwon_p";

export const CONSULT_PHONE_LABEL = "전화 문의";
export const CONSULT_PHONE_DISPLAY = CONSULT_PHONE_PARTS.join("-");
export const CONSULT_CALLBACK_NOTICE =
  "통화 연결이 어려울 경우 문자를 남겨주시면 확인 후 연락드리겠습니다.";
export const START_GUIDANCE_NOTICE =
  "이용을 시작하시면 개발자가 직접 프로그램을 소개하고 직원·강사분들께 사용법을 안내해 드립니다.";
export const PLANNED_PAYMENT_NOTICE =
  "원비·교재비 온라인 결제 기능은 도입 예정입니다. 현재는 온라인 결제를 지원하지 않으며, 일정은 확정되는 대로 안내드립니다.";
export const MONTHLY_VAT_RATE_PERCENT = 10;
export const AUGUST_MONTHLY_SUPPLY_AMOUNT = 145000;
export const AUGUST_MONTHLY_TAX_AMOUNT = 14000;
export const AUGUST_MONTHLY_TOTAL_AMOUNT = 159000;
export const POST_AUGUST_MONTHLY_SUPPLY_AMOUNT = 180000;
export const POST_AUGUST_MONTHLY_TAX_AMOUNT = 18000;
export const POST_AUGUST_MONTHLY_TOTAL_AMOUNT = 198000;
export const AUGUST_PROMOTION_LABEL = "2026년 8월 가입 혜택 · 신규 적용 종료";
export const AUGUST_MONTHLY_SAVINGS =
  POST_AUGUST_MONTHLY_SUPPLY_AMOUNT - AUGUST_MONTHLY_SUPPLY_AMOUNT;
export const AUGUST_PRICE_GUARANTEE =
  "2026년 8월 1일부터 31일까지 가입한 학원은 월 145,000원(고정 부가세 14,000원 별도, 결제금액 159,000원)으로 이용하며, 해당 공급가는 이용 기간 동안 계속 적용됩니다.";
export const POST_AUGUST_PRICE_POLICY =
  "2026년 9월 1일부터 가입하는 학원은 월 180,000원(부가세 10% 별도, 결제금액 198,000원)입니다.";

export function getConsultPhoneTelHref() {
  return `tel:${CONSULT_PHONE_PARTS.join("")}`;
}

export const PRICE_POLICY_NOTES = [
  AUGUST_PRICE_GUARANTEE,
  POST_AUGUST_PRICE_POLICY,
  "안내된 기능을 모두 이용할 수 있으며, 수강생 수나 계정 수에 따른 추가 요금은 없습니다.",
  "기본 저장공간은 200GB입니다. 추가 저장공간이 필요하면 별도 협의합니다.",
  "알림톡 발송비, 저장공간 초과, 대량 데이터 이전, 커스텀 개발은 별도 협의입니다.",
];

export interface PromoPlanDef {
  name: string;
  key: string;
  monthlySupplyAmount: number;
  monthlyTaxAmount: number;
  monthlyTotalAmount: number;
  postAugustMonthlySupplyAmount: number;
  postAugustMonthlyTaxAmount: number;
  postAugustMonthlyTotalAmount: number;
  monthlySavings: number;
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
    name: "학원플러스 기본 요금",
    key: "all",
    monthlySupplyAmount: AUGUST_MONTHLY_SUPPLY_AMOUNT,
    monthlyTaxAmount: AUGUST_MONTHLY_TAX_AMOUNT,
    monthlyTotalAmount: AUGUST_MONTHLY_TOTAL_AMOUNT,
    postAugustMonthlySupplyAmount: POST_AUGUST_MONTHLY_SUPPLY_AMOUNT,
    postAugustMonthlyTaxAmount: POST_AUGUST_MONTHLY_TAX_AMOUNT,
    postAugustMonthlyTotalAmount: POST_AUGUST_MONTHLY_TOTAL_AMOUNT,
    monthlySavings: AUGUST_MONTHLY_SAVINGS,
    target: "2026년 9월 1일 이후 가입 학원",
    positioning: "현재 신규 가입 요금",
    verdict: "신규 가입은 월 180,000원(부가세 10% 별도)이며, 8월 가입 학원의 기존 요금은 유지됩니다.",
    studentLimit: "학생 수에 따른 추가 요금 없음",
    adminLimit: "계정 수에 따른 추가 요금 없음",
    storage: "200GB 포함",
    popular: true,
    features: [
      "학생·강의·수업·출결 관리",
      "시험·과제·성적 분석",
      "객관식·OX형·일부 수학 단답형(0~999 정수) 자동채점과 서술형 직접 채점",
      "학부모 상담 자료와 알림톡 연동",
      "보강·클리닉 운영",
      "학생앱 영상 복습과 시청 이력",
      "매치업·적중 리포트·공개 소개 페이지",
      "강사·스태프 권한 관리",
      "저장공간 200GB와 초기 설정 안내",
    ],
    cta: "시연 신청",
    ctaLink: "/promo/demo",
  },
];

export function formatWon(value: number) {
  return value.toLocaleString("ko-KR");
}

export function formatKoreanPrice(value: number) {
  return `${formatWon(value)}원`;
}
