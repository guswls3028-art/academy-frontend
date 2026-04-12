// PATH: src/app_promo/domains/landing/pages/AiGradingPage.tsx
import CtaSection from "../components/CtaSection";

const TIERS = [
  {
    level: "1단계",
    title: "안정적으로 구현된 범위",
    color: "text-blue-600 bg-blue-50",
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
    color: "text-indigo-600 bg-indigo-50",
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
    color: "text-violet-600 bg-violet-50",
    items: [
      "서술형 초안 채점 제안",
      "답변 요약",
      "핵심 키워드 포함 분석",
      "루브릭 기반 점수 추천",
      "교사용 검수 화면 제공",
    ],
  },
];

const WORKFLOW = [
  "시험 생성 시 문항별 채점 방식 설정",
  "자동채점 실행 또는 제출 시 자동 실행",
  "채점 결과 대량 검토 화면",
  "이의 가능 문항 필터",
  "교사 검수 후 확정 처리",
  "확정 결과를 성적표·통계로 반영",
];

export default function AiGradingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            AI 자동채점
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            객관식부터 서술형 보조 평가까지.
            반복 채점 업무를 줄이는 실무형 AI 채점 시스템.
          </p>
        </div>
      </section>

      {/* Definition */}
      <section className="py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-5 rounded-xl bg-blue-50/60 border border-blue-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              AI 자동채점은 모든 문제를 완전 자동으로 평가한다는 의미가 아니라,
              <strong> 문항 유형에 따라 자동 판정 또는 교사 보조 평가를 지원하는 채점 시스템</strong>입니다.
            </p>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">지원 범위</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map((t) => (
              <div key={t.level} className="p-6 rounded-2xl border border-gray-100 bg-white">
                <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full mb-3 ${t.color}`}>
                  {t.level}
                </span>
                <h3 className="font-bold text-gray-900 mb-4">{t.title}</h3>
                <ul className="space-y-2">
                  {t.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-300 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-14 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">관리자 워크플로우</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {WORKFLOW.map((item, i) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principle */}
      <section className="py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-100">
            <h3 className="font-bold text-gray-900 mb-2 text-sm">운영 원칙</h3>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li>· 최종 점수 확정 권한은 관리자/교사에게 있습니다.</li>
              <li>· 자동채점 결과는 로그와 함께 검토 가능합니다.</li>
              <li>· 문항 유형별로 자동채점 허용 여부를 설정할 수 있습니다.</li>
              <li>· 서술형 평가는 '초안 채점 + 교사 검수' 구조를 권장합니다.</li>
            </ul>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
