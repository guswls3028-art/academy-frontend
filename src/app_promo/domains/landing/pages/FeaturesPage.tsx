// PATH: src/app_promo/domains/landing/pages/FeaturesPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";

interface FeatureGroup {
  category: string;
  color: string;
  items: { title: string; desc: string }[];
}

const GROUPS: FeatureGroup[] = [
  {
    category: "수강생/수업 관리",
    color: "bg-blue-600",
    items: [
      { title: "수강생 등록 및 상태 관리", desc: "수강생 기본 정보, 수강 상태, 수업 메모를 한 곳에서 관리합니다." },
      { title: "반/수업 편성", desc: "강의·차시 단위로 반을 구성하고 수강생을 배정합니다." },
      { title: "출결 관리", desc: "수업별 출결을 기록하고 이력을 추적합니다." },
      { title: "학부모/수강생 연락 관리", desc: "수강생-학부모 연결 및 커뮤니케이션 채널을 통합합니다." },
    ],
  },
  {
    category: "시험/과제/성적",
    color: "bg-indigo-600",
    items: [
      { title: "시험 생성", desc: "객관식, 단답형, 서술형 등 다양한 문항 유형을 지원합니다." },
      { title: "과제 생성 및 제출", desc: "과제를 생성하고 수강생 제출 현황을 실시간 확인합니다." },
      { title: "성적 입력 및 분석", desc: "점수 입력, 등급 산정, 수강생별·시험별 분석 리포트를 제공합니다." },
      { title: "리포트/피드백", desc: "수강생별 피드백을 기록하고 성적표에 반영합니다." },
    ],
  },
  {
    category: "AI 자동채점",
    color: "bg-violet-600",
    items: [
      { title: "객관식·단답형 자동채점", desc: "정답 매칭으로 즉시 채점합니다." },
      { title: "서술형 보조 평가", desc: "키워드 분석, 루브릭 기반 점수 추천을 AI가 제안합니다." },
      { title: "검수 워크플로우", desc: "자동채점 결과를 강사가 검토·확정하는 흐름을 제공합니다." },
    ],
  },
  {
    category: "영상 학습",
    color: "bg-rose-500",
    items: [
      { title: "강의 영상 등록", desc: "차시별 영상을 업로드하고 공개 범위를 설정합니다." },
      { title: "학생전용앱 재생", desc: "수강생이 앱에서 강의 목록, 재생 목록, 이어보기까지 확인합니다." },
      { title: "자체 플레이어 재생", desc: "이어보기, 배속, 전체화면, 댓글 등 학습에 맞춘 재생 경험을 제공합니다." },
      { title: "재생 이력 추적", desc: "수강생별 시청 시간, 마지막 위치, 완료 여부를 자동 수집합니다." },
      { title: "학습 흐름 연동", desc: "영상 → 과제 → 시험 → 후속 안내로 자연스럽게 연결됩니다." },
    ],
  },
  {
    category: "커뮤니케이션",
    color: "bg-amber-500",
    items: [
      { title: "알림톡 자동발송", desc: "학원 운영 이벤트가 발생하면 승인 템플릿 기준으로 알림톡을 자동 발송합니다." },
      { title: "입실·결석 알림", desc: "출결 처리와 동시에 학부모에게 입실 또는 결석 상황을 안내합니다." },
      { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 기준으로 수업 결과를 발송합니다." },
      { title: "영상 시청 안내", desc: "미시청 학생에게 복습 영상 확인을 독려하는 안내를 보낼 수 있습니다." },
      { title: "학부모 커뮤니케이션", desc: "학부모에게 학습 현황, 성적, 보강 결과를 일관된 문구로 공유합니다." },
      { title: "질문 응답(QnA)", desc: "수강생 질문에 강사가 답변하는 게시판을 제공합니다." },
    ],
  },
  {
    category: "보강/클리닉",
    color: "bg-emerald-600",
    items: [
      { title: "보강 예약 관리", desc: "보강 일정을 등록하고 수강생별 이력을 관리합니다." },
      { title: "피드백 기록", desc: "상담·피드백 내용을 기록하고 후속 조치를 추적합니다." },
      { title: "후속 조치 관리", desc: "보강 결과에 따른 학습 계획 조정을 지원합니다." },
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
            강사님의 수업 운영에 필요한 기능을 카테고리별로 확인하세요.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {GROUPS.map((g) => (
            <div key={g.category}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-1 h-6 rounded-full ${g.color}`} />
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
