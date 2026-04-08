// PATH: src/promo/pages/FaqPage.tsx
import CtaSection from "../components/CtaSection";

const FAQS = [
  {
    q: "AI 자동채점은 어떤 유형의 문제를 지원하나요?",
    a: "객관식, OX형, 단답형(키워드 일치)은 완전 자동 채점됩니다. 서술형은 AI가 초안 점수를 제안하고 교사가 최종 검수하는 보조 평가 구조를 제공합니다. 과목이나 문항 유형에 따라 자동채점 범위가 달라질 수 있습니다.",
  },
  {
    q: "서술형도 완전 자동으로 채점되나요?",
    a: "아닙니다. 서술형 평가는 '초안 채점 + 교사 검수' 구조를 기본으로 합니다. AI가 핵심 키워드 포함 여부, 루브릭 기반 점수를 제안하면 교사가 최종 확정합니다.",
  },
  {
    q: "자체 동영상 플레이어는 어떤 기능을 제공하나요?",
    a: "이어보기(재생 위치 저장), 배속 조절, 전체화면, 모바일/태블릿 대응 등의 재생 기능과 학생별 시청 이력 기록, 차시 연결, 수강 상태 확인 등의 학습 연동 기능을 제공합니다.",
  },
  {
    q: "기존 영상 또는 자료 이전이 가능한가요?",
    a: "기존 영상 파일을 업로드하여 등록할 수 있습니다. 대량 이전이 필요한 경우 도입 상담 시 별도 지원을 제공합니다.",
  },
  {
    q: "학원 규모에 따라 요금이 어떻게 달라지나요?",
    a: "Standard(99,000원/월), Pro(198,000원/월), Max(330,000원/월) 3단계로 구성됩니다. Standard와 Pro는 동일한 기능을 제공하며, 학생 수와 관리자 계정 수에 차이가 있습니다.",
  },
  {
    q: "데모 요청 후 도입 절차는 어떻게 되나요?",
    a: "데모 요청 접수 → 담당자 연락 → 운영 환경 파악 → 맞춤 시연 → 도입 상담 → 계정 설정 순으로 진행됩니다. 상담부터 도입까지 빠르게 진행됩니다.",
  },
  {
    q: "기존 시험/학생 데이터를 이전할 수 있나요?",
    a: "CSV, Excel 기반 학생 데이터 일괄 등록을 지원합니다. 시험 데이터 이전은 도입 상담 시 범위를 확인하고 지원합니다.",
  },
  {
    q: "관리자/강사 권한을 나눌 수 있나요?",
    a: "네. Owner(원장), Admin(관리자), Teacher(강사), Staff(직원) 등 역할별 권한 체계를 제공합니다. 각 역할에 따라 접근 가능한 메뉴와 기능이 구분됩니다.",
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">자주 묻는 질문</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            학원플러스 도입에 대해 궁금한 점을 확인하세요.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-4">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-100 transition-colors"
              >
                <summary className="cursor-pointer font-semibold text-gray-900 text-sm flex items-center justify-between">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform ml-4 flex-shrink-0">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="더 궁금한 점이 있으신가요?"
        subtitle="문의 폼을 통해 자유롭게 질문해주세요."
      />
    </>
  );
}
