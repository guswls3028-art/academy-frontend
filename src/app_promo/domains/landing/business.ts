// PATH: src/app_promo/domains/landing/business.ts

const CONSULT_PHONE_PARTS = ["010", "3121", "7466"] as const;

export const CONSULT_PHONE_LABEL = "전화 문의";

export function getConsultPhoneTelHref() {
  return `tel:${CONSULT_PHONE_PARTS.join("")}`;
}

export const PRICE_POLICY_NOTES = [
  "월 구독 요금이며 부가세 별도입니다.",
  "Standard와 Pro는 기본 기능은 같고, 수강생 수·계정 수·저장공간·지원 방식에서 차이가 납니다.",
  "학부모 리포트, 알림톡, 공개 소개 페이지는 수강생 수와 발송량에 따라 비용이 달라질 수 있습니다.",
  "문자/SMS/알림톡 발송비, 저장공간 초과, 대량 데이터 이전, 커스텀 개발은 별도 협의입니다.",
  "수강생 수는 활성 수강생 기준입니다. 기준을 넘으면 상위 플랜 또는 별도 견적으로 전환합니다.",
];

export interface PromoPlanDef {
  name: string;
  key: string;
  monthlyPrice: number;
  target: string;
  positioning: string;
  verdict: string;
  studentLimit: string;
  adminLimit: string;
  storage: string;
  support: string;
  popular?: boolean;
  features: string[];
  cta: string;
  ctaLink: string;
  ctaKind?: "phone";
}

export const PROMO_PLANS: PromoPlanDef[] = [
  {
    name: "Standard",
    key: "standard",
    monthlyPrice: 99000,
    target: "개인 강사 / 수강생 100명 이하",
    positioning: "엑셀·수기 관리를 줄이려는 선생님",
    verdict: "출결·시험·영상·알림톡부터 시작",
    studentLimit: "100명 이하",
    adminLimit: "3개",
    storage: "10GB",
    support: "기본 지원",
    features: [
      "Pro와 동일한 기본 기능 제공",
      "학부모 리포트 기본",
      "수업·성적·영상 요약",
      "시험·과제 관리",
      "자동채점",
      "성적 분석",
      "학생앱 영상 복습",
      "알림톡 발송 연동",
      "전화 문의 지원",
    ],
    cta: "전화 문의",
    ctaLink: "/promo/contact",
    ctaKind: "phone",
  },
  {
    name: "Pro",
    key: "pro",
    monthlyPrice: 198000,
    target: "전임 강사·팀 수업 / 수강생 300명 이하",
    positioning: "여러 반을 꾸준히 관리하는 팀",
    verdict: "채점·피드백·영상·학부모 안내까지 함께 관리",
    studentLimit: "300명 이하",
    adminLimit: "5개",
    storage: "50GB",
    support: "우선 지원",
    popular: true,
    features: [
      "Standard의 모든 기능 포함",
      "주간 학부모 리포트",
      "적중 리포트 공개 페이지",
      "수강생 수·계정 한도 확장",
      "알림톡·보강 관리 확장",
      "영상 시청 이력 확인",
      "저장공간 50GB",
      "우선 지원",
    ],
    cta: "데모 요청",
    ctaLink: "/promo/demo",
  },
  {
    name: "Max",
    key: "max",
    monthlyPrice: 330000,
    target: "여러 반·강사팀 / 팀 단위 수업",
    positioning: "학교별 내신반과 여러 강사를 함께 운영",
    verdict: "초기 세팅과 운영 지원이 중요한 팀",
    studentLimit: "무제한",
    adminLimit: "무제한",
    storage: "200GB",
    support: "전담 온보딩",
    features: [
      "Pro의 모든 기능 포함",
      "초기 세팅 동행",
      "학교별 리포트 템플릿",
      "적중 리포트 상담 자료",
      "수강생 수·계정 무제한",
      "강사·스태프 권한 구조 확장",
      "서술형 보조 평가",
      "저장공간 200GB",
      "별도 온보딩 + 전담 매니저",
    ],
    cta: "데모 예약",
    ctaLink: "/promo/demo",
  },
];

export const PRICE_COMPARISON = [
  { feature: "월 구독료", standard: "99,000원", pro: "198,000원", max: "330,000원" },
  { feature: "수강생 수", standard: "100명 이하", pro: "300명 이하", max: "무제한" },
  { feature: "사용 계정", standard: "3개", pro: "5개", max: "무제한" },
  { feature: "저장공간", standard: "10GB", pro: "50GB", max: "200GB" },
  { feature: "시험/과제 관리", standard: "포함", pro: "포함", max: "포함" },
  { feature: "학부모 리포트", standard: "기본", pro: "주간 운영", max: "학교별 템플릿 포함" },
  { feature: "적중 리포트 공개 홍보", standard: "기본", pro: "공개 페이지 게시 포함", max: "상담/공유 패키지 포함" },
  { feature: "자동채점", standard: "포함", pro: "포함", max: "서술형 보조 포함" },
  { feature: "서술형 보조", standard: "별도 협의", pro: "별도 협의", max: "포함" },
  { feature: "학생앱 영상", standard: "포함", pro: "이력 확인 포함", max: "이력/분석 포함" },
  { feature: "알림톡 발송", standard: "발송비 별도", pro: "발송비 별도", max: "발송비 별도" },
  { feature: "보강/클리닉", standard: "포함", pro: "포함", max: "포함" },
  { feature: "온보딩", standard: "가이드", pro: "가이드 + 우선 지원", max: "전담 온보딩" },
  { feature: "지원 방식", standard: "전화 문의", pro: "우선 지원", max: "전담 매니저" },
];

export function formatWon(value: number) {
  return value.toLocaleString("ko-KR");
}
