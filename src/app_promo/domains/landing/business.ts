// PATH: src/app_promo/domains/landing/business.ts

const CONSULT_PHONE_PARTS = ["010", "3121", "7466"] as const;

export const CONSULT_PHONE_LABEL = "전화 문의";
export const AUGUST_MONTHLY_SUPPLY_AMOUNT = 145000;
export const AUGUST_MONTHLY_TAX_AMOUNT = 14000;
export const AUGUST_MONTHLY_TOTAL_AMOUNT = 159000;
export const AUGUST_PROMOTION_LABEL = "2026년 8월 가입 월 145,000원 (부가세 별도)";
export const STANDARD_MONTHLY_SUPPLY_AMOUNT = 180000;
export const STANDARD_MONTHLY_TAX_AMOUNT = 18000;
export const STANDARD_MONTHLY_TOTAL_AMOUNT = 198000;
export const AUGUST_MONTHLY_SAVINGS =
  STANDARD_MONTHLY_TOTAL_AMOUNT - AUGUST_MONTHLY_TOTAL_AMOUNT;
export const AUGUST_PRICE_GUARANTEE =
  "2026년 8월 1일부터 31일까지 가입한 학원은 공급가 월 145,000원(부가세 별도), 실제 월 결제 159,000원이 이용 기간 동안 계속 적용됩니다.";

export function getConsultPhoneTelHref() {
  return `tel:${CONSULT_PHONE_PARTS.join("")}`;
}

export const PRICE_POLICY_NOTES = [
  "평소 요금은 월 공급가 180,000원, 부가가치세 18,000원(10%), 총 198,000원입니다.",
  "2026년 8월 가입 적용 요금은 월 공급가 145,000원, 부가가치세 14,000원, 총 159,000원입니다.",
  AUGUST_PRICE_GUARANTEE,
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
  standardMonthlySupplyAmount: number;
  standardMonthlyTaxAmount: number;
  standardMonthlyTotalAmount: number;
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
    standardMonthlySupplyAmount: STANDARD_MONTHLY_SUPPLY_AMOUNT,
    standardMonthlyTaxAmount: STANDARD_MONTHLY_TAX_AMOUNT,
    standardMonthlyTotalAmount: STANDARD_MONTHLY_TOTAL_AMOUNT,
    monthlySavings: AUGUST_MONTHLY_SAVINGS,
    target: "2026년 8월 1일~31일 가입 학원",
    positioning: "2026년 8월 가입 월 공급가",
    verdict: "평소 월 요금보다 39,000원 낮습니다",
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
    cta: "내 자료로 데모 요청",
    ctaLink: "/promo/demo",
  },
];

export function formatWon(value: number) {
  return value.toLocaleString("ko-KR");
}
