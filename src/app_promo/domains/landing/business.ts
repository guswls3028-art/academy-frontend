// PATH: src/app_promo/domains/landing/business.ts

const CONSULT_PHONE_PARTS = ["010", "3121", "7466"] as const;

export const CONSULT_PHONE_LABEL = "전화 문의";
export const AUGUST_MONTHLY_SUPPLY_AMOUNT = 145000;
export const POST_AUGUST_MONTHLY_SUPPLY_AMOUNT = 160000;
export const AUGUST_PROMOTION_LABEL = "2026년 8월 가입 혜택";
export const AUGUST_MONTHLY_SAVINGS =
  POST_AUGUST_MONTHLY_SUPPLY_AMOUNT - AUGUST_MONTHLY_SUPPLY_AMOUNT;
export const AUGUST_PRICE_GUARANTEE =
  "2026년 8월 1일부터 31일까지 가입한 학원은 월 14만 5천원(부가세 별도)으로 이용할 수 있으며, 해당 요금은 이용 기간 동안 계속 적용됩니다.";
export const POST_AUGUST_PRICE_POLICY =
  "2026년 9월 1일부터 가입하는 학원은 월 16만원(부가세 별도)입니다.";

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
  postAugustMonthlySupplyAmount: number;
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
    postAugustMonthlySupplyAmount: POST_AUGUST_MONTHLY_SUPPLY_AMOUNT,
    monthlySavings: AUGUST_MONTHLY_SAVINGS,
    target: "2026년 8월 1일~31일 가입 학원",
    positioning: "2026년 8월 가입 요금",
    verdict: "8월에 가입하면 월 14만 5천원 요금이 이용 기간 동안 유지됩니다.",
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

export function formatKoreanPrice(value: number) {
  const tenThousands = Math.floor(value / 10000);
  const remainder = value % 10000;

  if (remainder === 0) return `${tenThousands}만원`;
  if (remainder % 1000 === 0) return `${tenThousands}만 ${remainder / 1000}천원`;
  return `${formatWon(value)}원`;
}
