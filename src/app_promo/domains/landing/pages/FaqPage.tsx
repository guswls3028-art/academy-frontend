// PATH: src/app_promo/domains/landing/pages/FaqPage.tsx
import CtaSection from "../components/CtaSection";
import { CONSULT_PHONE_DISPLAY } from "../business";

const FAQS = [
  {
    q: "AI 자동채점은 어떤 유형의 문제를 지원하나요?",
    a: "객관식, OX형, 단답형(키워드 일치)은 완전 자동 채점됩니다. 서술형은 AI가 초안 점수를 제안하고 강사가 최종 검수하는 보조 평가 구조를 제공합니다. 과목이나 문항 유형에 따라 자동채점 범위가 달라질 수 있습니다.",
  },
  {
    q: "서술형도 완전 자동으로 채점되나요?",
    a: "아닙니다. 서술형 평가는 '초안 채점 + 강사 검수' 구조를 기본으로 합니다. AI가 핵심 키워드 포함 여부, 루브릭 기반 점수를 제안하면 강사가 최종 확정합니다.",
  },
  {
    q: "자체 동영상 플레이어는 어떤 기능을 제공하나요?",
    a: "수강생은 학생전용앱에서 강의 목록, 재생 목록, 이어보기, 댓글을 사용할 수 있습니다. 강사님은 수강생별 시청 시간, 마지막 재생 위치, 미시청·시청중·완료 상태를 확인해 후속 지도를 잡을 수 있습니다.",
  },
  {
    q: "학생전용앱에서 영상을 볼 수 있나요?",
    a: "네. 수강생은 별도 학생앱에서 강의별 영상을 보고 마지막으로 보던 지점부터 이어볼 수 있습니다. 영상은 차시 흐름과 연결되며 모바일과 태블릿 화면에 맞춰 제공됩니다.",
  },
  {
    q: "알림톡 자동발송은 어떤 상황에서 되나요?",
    a: "입실·결석, 수업결과, 영상 시청 안내처럼 운영 이벤트와 연결되는 알림톡 자동발송을 제공합니다. 실제 발송 가능 범위는 승인 템플릿과 카카오 알림톡 정책, 학원별 설정에 맞춰 상담 시 확인합니다.",
  },
  {
    q: "기존 영상 또는 자료 이전이 가능한가요?",
    a: "기존 영상 파일을 업로드하여 등록할 수 있습니다. 대량 이전이 필요한 경우 상담 시 자료량과 일정에 맞춰 별도 지원 범위를 확인합니다.",
  },
  {
    q: "담당 수강생 수에 따라 요금이 어떻게 달라지나요?",
    a: "Standard(99,000원/월), Pro(198,000원/월), Max(330,000원/월) 3단계로 구성됩니다. 부가세는 별도이며, 문자/SMS/알림톡 발송비와 대량 이전·커스텀 개발은 별도 협의입니다. 애매한 경우 전화 상담으로 바로 확인하실 수 있습니다.",
  },
  {
    q: "데모 요청 후 진행 절차는 어떻게 되나요?",
    a: "데모 요청 접수 → 담당자 연락 → 수업 방식 파악 → 맞춤 시연 → 가격·일정 상담 → 계정 설정 순으로 진행됩니다.",
  },
  {
    q: "기존 시험/수강생 데이터를 이전할 수 있나요?",
    a: "CSV, Excel 기반 수강생 데이터 일괄 등록을 지원합니다. 시험 데이터 이전은 상담 시 범위를 확인하고 지원합니다.",
  },
  {
    q: "강사/스태프 권한을 나눌 수 있나요?",
    a: "네. 대표 강사, 보조강사, 스태프처럼 역할별 권한을 나눌 수 있습니다. 혼자 쓰는 경우에는 단일 계정으로 시작하고, 팀 수업으로 확장할 때 계정을 추가하면 됩니다.",
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">자주 묻는 질문</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            강사님이 수업에 쓰기 전에 궁금해할 만한 점을 확인하세요.
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
        subtitle={`문의 폼 또는 전화 ${CONSULT_PHONE_DISPLAY}로 자유롭게 질문해주세요.`}
      />
    </>
  );
}
