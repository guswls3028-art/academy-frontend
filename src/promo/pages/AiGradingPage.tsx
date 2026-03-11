// PATH: src/promo/pages/AiGradingPage.tsx
import SectionHeading from "../components/SectionHeading";
import CtaSection from "../components/CtaSection";

const TIERS = [
  {
    level: "1단계",
    title: "안정적으로 구현된 범위",
    color: "blue",
    items: [
      "객관식 자동채점",
      "OX형 자동채점",
      "단답형 키워드 일치 채점",
      "문항별 배점 자동 계산",
      "총점 자동 합산",
      "정답/오답/미응답 구분",
    ],
  },
  {
    level: "2단계",
    title: "운영 정책에 따라 확장 가능",
    color: "indigo",
    items: [
      "유사 정답 허용 사전",
      "오탈자 허용 규칙",
      "복수 정답 허용",
      "부분 점수 규칙",
      "문항별 피드백 템플릿 추천",
    ],
  },
  {
    level: "3단계",
    title: "AI 보조 평가",
    color: "violet",
    items: [
      "서술형 초안 채점 제안",
      "답변 요약",
      "핵심 키워드 포함 분석",
      "루브릭 기반 점수 추천",
      "교사용 검수 화면 제공",
    ],
  },
];

const UX_ITEMS = [
  "시험 생성 시 문항별 채점 방식 설정",
  "자동채점 실행 또는 제출 시 자동 실행",
  "채점 결과 대량 검토 화면",
  "이의 가능 문항 필터",
  "교사 검수 후 확정 처리",
  "확정 결과를 성적표·통계로 반영",
];

const BENEFITS = [
  { icon: "⏱️", title: "채점 시간 단축", desc: "객관식·단답형은 즉시 채점되어 운영 효율이 높아집니다." },
  { icon: "📏", title: "일관된 1차 평가", desc: "동일 기준으로 모든 답안을 평가하여 편차를 줄입니다." },
  { icon: "🎯", title: "피드백 집중도 향상", desc: "교사가 서술형 검수와 피드백에 더 집중할 수 있습니다." },
  { icon: "⚡", title: "빠른 결과 제공", desc: "시험 종료 후 즉시 결과를 확인할 수 있습니다." },
];

export default function AiGradingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-blue-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full mb-4">
            AI 자동채점
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            객관식부터 서술형 보조 평가까지
          </h1>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto">
            반복 채점 업무를 줄이는 실무형 AI 채점 시스템.
            자동채점은 빠르게, 최종 검수는 신중하게.
          </p>
        </div>
      </section>

      {/* Definition */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              AI 자동채점은 모든 문제를 완전 자동으로 평가한다는 의미가 아니라,
              <strong> 문항 유형에 따라 자동 판정 또는 교사 보조 평가를 지원하는 채점 시스템</strong>입니다.
              과목·문항 유형·운영 정책에 따라 자동채점 범위는 다를 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="지원 범위" subtitle="단계별로 확장되는 AI 채점 기능" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((t) => (
              <div key={t.level} className="p-6 rounded-2xl border border-gray-100 bg-white">
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full mb-3 ${
                  t.color === "blue" ? "text-blue-600 bg-blue-50" :
                  t.color === "indigo" ? "text-indigo-600 bg-indigo-50" :
                  "text-violet-600 bg-violet-50"
                }`}>
                  {t.level}
                </span>
                <h3 className="font-bold text-gray-900 mb-4">{t.title}</h3>
                <ul className="space-y-2">
                  {t.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin UX */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="관리자 UX" subtitle="채점부터 확정까지 매끄러운 워크플로우" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {UX_ITEMS.map((item, i) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="도입 효과" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {BENEFITS.map((b) => (
              <div key={b.title} className="text-center p-6">
                <div className="text-4xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{b.title}</h3>
                <p className="text-xs text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principle */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">운영 원칙</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 최종 점수 확정 권한은 관리자/교사에게 있습니다.</li>
              <li>• 자동채점 결과는 로그와 함께 검토 가능합니다.</li>
              <li>• 문항 유형별로 자동채점 허용 여부를 설정할 수 있습니다.</li>
              <li>• 서술형 평가는 '초안 채점 + 교사 검수' 구조를 권장합니다.</li>
            </ul>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
