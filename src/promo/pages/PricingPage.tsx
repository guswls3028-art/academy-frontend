// PATH: src/promo/pages/PricingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";

interface PlanDef {
  name: string;
  price: string;
  target: string;
  popular?: boolean;
  features: string[];
  cta: string;
  ctaLink: string;
}

const PLANS: PlanDef[] = [
  {
    name: "Lite",
    price: "55,000",
    target: "소형 학원 / 초기 도입",
    features: [
      "학생 수 50명 이하",
      "관리자 계정 2개",
      "기본 운영 기능 (학생·반 관리)",
      "시험/과제 관리",
      "문자 자동발송 지원",
      "AI 자동채점 (객관식·단답형)",
      "동영상 플레이어 기본 제공",
      "카카오톡/전화 지원",
    ],
    cta: "문의하기",
    ctaLink: "/promo/contact",
  },
  {
    name: "Basic",
    price: "150,000",
    target: "중형 학원 / 실무 운영",
    popular: true,
    features: [
      "학생 수 200명 이하",
      "관리자 계정 5개",
      "성적 분석 강화 (리포트·통계)",
      "메시지/상담 기능 강화",
      "AI 자동채점 고급 설정",
      "시청 이력 관리",
      "우선 지원",
      "Lite의 모든 기능 포함",
    ],
    cta: "데모 요청",
    ctaLink: "/promo/demo",
  },
  {
    name: "Premium",
    price: "300,000",
    target: "대형 학원 / 프리미엄",
    features: [
      "학생 수 무제한",
      "관리자 계정 무제한",
      "커스텀 정책 지원",
      "관리자 권한 구조 확장",
      "AI 서술형 보조 평가",
      "별도 온보딩 지원",
      "전담 지원 매니저",
      "Basic의 모든 기능 포함",
    ],
    cta: "데모 요청",
    ctaLink: "/promo/demo",
  },
];

const COMPARISON = [
  { feature: "학생 수", lite: "50명", basic: "200명", premium: "무제한" },
  { feature: "관리자 계정", lite: "2개", basic: "5개", premium: "무제한" },
  { feature: "시험/과제 관리", lite: "✓", basic: "✓", premium: "✓" },
  { feature: "성적 분석", lite: "기본", basic: "고급", premium: "고급 + 커스텀" },
  { feature: "AI 자동채점 (객관식)", lite: "✓", basic: "✓", premium: "✓" },
  { feature: "AI 자동채점 (고급)", lite: "—", basic: "✓", premium: "✓" },
  { feature: "AI 서술형 보조", lite: "—", basic: "—", premium: "✓" },
  { feature: "동영상 플레이어", lite: "기본", basic: "고급", premium: "고급 + 분석" },
  { feature: "문자 자동발송", lite: "✓", basic: "✓", premium: "✓" },
  { feature: "상담/클리닉", lite: "—", basic: "✓", premium: "✓" },
  { feature: "지원 방식", lite: "카카오톡/전화", basic: "우선 지원", premium: "전담 매니저" },
  { feature: "온보딩", lite: "셀프", basic: "가이드", premium: "전담" },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-blue-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">요금제</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            학원 규모와 운영 방식에 맞는 플랜을 선택하세요.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col p-7 rounded-2xl border-2 ${
                  p.popular
                    ? "border-blue-500 shadow-xl shadow-blue-100 relative"
                    : "border-gray-100"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-full">
                    추천
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-5">{p.target}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">₩{p.price}</span>
                  <span className="text-sm text-gray-400"> / 월</span>
                </div>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={p.ctaLink}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    p.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">플랜별 비교</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-900">기능</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Lite</th>
                  <th className="text-center py-3 px-4 font-semibold text-blue-600">Basic</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Premium</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-100">
                    <td className="py-3 pr-4 text-gray-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-gray-500">{row.lite}</td>
                    <td className="py-3 px-4 text-center text-gray-700 font-medium">{row.basic}</td>
                    <td className="py-3 px-4 text-center text-gray-500">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CtaSection
        title="우리 학원 규모에 맞는 견적을 받아보세요"
        subtitle="데모 후 맞춤 제안을 드립니다."
      />
    </>
  );
}
