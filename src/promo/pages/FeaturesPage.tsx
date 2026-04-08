// PATH: src/promo/pages/FeaturesPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";

interface FeatureGroup {
  category: string;
  color: string;
  items: { title: string; desc: string }[];
}

const GROUPS: FeatureGroup[] = [
  {
    category: "학생/운영 관리",
    color: "bg-blue-600",
    items: [
      { title: "학생 등록 및 상태 관리", desc: "학생 기본 정보, 입학/수료 상태, 메모를 한 곳에서 관리합니다." },
      { title: "반/수업 편성", desc: "강의·차시 단위로 반을 구성하고 학생을 배정합니다." },
      { title: "출결 관리", desc: "수업별 출결을 기록하고 이력을 추적합니다." },
      { title: "학부모/학생 연락 관리", desc: "학생-학부모 연결 및 커뮤니케이션 채널을 통합합니다." },
    ],
  },
  {
    category: "시험/과제/성적",
    color: "bg-indigo-600",
    items: [
      { title: "시험 생성", desc: "객관식, 단답형, 서술형 등 다양한 문항 유형을 지원합니다." },
      { title: "과제 생성 및 제출", desc: "과제를 생성하고 학생 제출 현황을 실시간 확인합니다." },
      { title: "성적 입력 및 분석", desc: "점수 입력, 등급 산정, 학생별·시험별 분석 리포트를 제공합니다." },
      { title: "리포트/피드백", desc: "학생별 피드백을 기록하고 성적표에 반영합니다." },
    ],
  },
  {
    category: "AI 자동채점",
    color: "bg-violet-600",
    items: [
      { title: "객관식·단답형 자동채점", desc: "정답 매칭으로 즉시 채점합니다." },
      { title: "서술형 보조 평가", desc: "키워드 분석, 루브릭 기반 점수 추천을 AI가 제안합니다." },
      { title: "검수 워크플로우", desc: "자동채점 결과를 교사가 검토·확정하는 흐름을 제공합니다." },
    ],
  },
  {
    category: "영상 학습",
    color: "bg-rose-500",
    items: [
      { title: "강의 영상 등록", desc: "차시별 영상을 업로드하고 공개 범위를 설정합니다." },
      { title: "자체 플레이어 재생", desc: "이어보기, 배속, 전체화면 등 학습에 최적화된 재생 경험." },
      { title: "재생 이력 추적", desc: "학생별 시청 시간, 완료 여부를 자동 수집합니다." },
      { title: "학습 흐름 연동", desc: "영상 → 과제 → 시험으로 자연스럽게 연결됩니다." },
    ],
  },
  {
    category: "커뮤니케이션",
    color: "bg-amber-500",
    items: [
      { title: "공지 발송", desc: "전체 또는 반별 공지를 빠르게 전달합니다." },
      { title: "예약 메시지", desc: "시간을 지정하여 메시지를 예약 발송합니다." },
      { title: "학부모 커뮤니케이션", desc: "학부모에게 학습 현황, 성적을 공유합니다." },
      { title: "질문 응답(QnA)", desc: "학생 질문에 강사가 답변하는 게시판을 제공합니다." },
    ],
  },
  {
    category: "상담/클리닉",
    color: "bg-emerald-600",
    items: [
      { title: "예약 관리", desc: "상담 일정을 등록하고 학생별 이력을 관리합니다." },
      { title: "상담 기록", desc: "상담 내용을 기록하고 후속 조치를 추적합니다." },
      { title: "후속 조치 관리", desc: "상담 결과에 따른 학습 계획 조정을 지원합니다." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">기능 소개</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            학원 운영에 필요한 모든 기능을 카테고리별로 확인하세요.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {GROUPS.map((g) => (
            <div key={g.category}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-2.5 h-2.5 rounded-full ${g.color}`} />
                <h2 className="text-lg font-bold text-gray-900">{g.category}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.items.map((item) => (
                  <div key={item.title} className="p-5 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow">
                    <h3 className="font-semibold text-gray-900 mb-1.5 text-sm">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 text-center">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/promo/ai-grading" className="px-6 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            AI 자동채점 상세 →
          </Link>
          <Link to="/promo/video-platform" className="px-6 py-2.5 text-sm font-semibold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors">
            동영상 플레이어 상세 →
          </Link>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
