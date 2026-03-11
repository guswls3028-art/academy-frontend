// PATH: src/promo/pages/LandingPage.tsx
import { Link } from "react-router-dom";
import SectionHeading from "../components/SectionHeading";
import CtaSection from "../components/CtaSection";

/* ── Hero ── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full mb-6">
          학원 전용 올인원 SaaS
        </span>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          학원 운영과 학습 관리를
          <br />
          <span className="text-blue-600">하나의 시스템</span>으로
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI 자동채점과 자체 동영상 플레이어를 갖춘 프리미엄 학원관리 플랫폼.
          <br className="hidden sm:block" />
          수업, 시험, 과제, 성적, 메시지, 영상 학습까지 한 번에.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/promo/demo"
            className="px-8 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            데모 요청
          </Link>
          <Link
            to="/promo/pricing"
            className="px-8 py-3.5 text-base font-semibold text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors border border-gray-200"
          >
            요금제 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Trust Badges ── */
const BADGES = [
  { icon: "🏫", text: "학원 운영 전용" },
  { icon: "🤖", text: "AI 자동채점 지원" },
  { icon: "🎬", text: "자체 동영상 플레이어" },
  { icon: "📊", text: "시험·과제·성적 통합" },
  { icon: "💬", text: "상담/문의 대응" },
];

function TrustBadges() {
  return (
    <section className="py-12 border-y border-gray-100 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {BADGES.map((b) => (
            <div key={b.text} className="flex items-center gap-2 text-gray-600">
              <span className="text-2xl">{b.icon}</span>
              <span className="text-sm font-medium">{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Problems & Solutions ── */
const PROBLEMS = [
  { problem: "시험과 과제가 따로 관리되어 번거롭다", solution: "하나의 시스템으로 통합 관리" },
  { problem: "채점과 성적 입력에 시간이 많이 든다", solution: "AI 자동채점으로 반복 업무 절감" },
  { problem: "외부 영상 플랫폼으로 학습 흐름이 끊긴다", solution: "자체 플레이어로 학습 흐름 유지" },
  { problem: "공지, 메시지, 상담 기록이 흩어져 있다", solution: "관리자·강사·학생 데이터 공유" },
];

function ProblemSolution() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="왜 학원플러스인가"
          title="이런 고민, 학원플러스가 해결합니다"
          subtitle="운영과 학습을 연결한 단일 시스템으로 정리하세요"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROBLEMS.map((item) => (
            <div
              key={item.problem}
              className="p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all bg-white"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-lg font-bold">
                  ✕
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-2">{item.problem}</p>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                      ✓
                    </span>
                    <p className="text-gray-900 font-semibold text-sm">{item.solution}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature Cards ── */
const FEATURES = [
  { icon: "👨‍🎓", title: "학생/반 관리", desc: "등록, 배정, 출결을 한 곳에서", link: "/promo/features" },
  { icon: "📝", title: "시험/과제 관리", desc: "생성부터 제출, 채점까지 원스톱", link: "/promo/features" },
  { icon: "📈", title: "성적 분석", desc: "학생별·시험별 성적 데이터 분석", link: "/promo/features" },
  { icon: "🤖", title: "AI 자동채점", desc: "객관식부터 서술형 보조까지", link: "/promo/ai-grading" },
  { icon: "🎬", title: "자체 동영상 플레이어", desc: "학습 흐름에 맞춘 시청 경험", link: "/promo/video-platform" },
  { icon: "💬", title: "메시지/알림", desc: "공지, 예약, 커뮤니케이션 자동화", link: "/promo/features" },
  { icon: "🩺", title: "상담/클리닉 관리", desc: "예약, 기록, 후속 조치", link: "/promo/features" },
  { icon: "❓", title: "QnA/커뮤니티", desc: "질문 응답과 자료 공유", link: "/promo/features" },
];

function FeatureCards() {
  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="핵심 기능"
          title="학원 운영에 필요한 모든 기능"
          subtitle="수업부터 성적, 메시지, 영상 학습까지"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              to={f.link}
              className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── AI Grading Highlight ── */
function AiGradingHighlight() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-4">
              AI 자동채점
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              반복 채점 업무를 줄이고
              <br />
              피드백 속도를 높이세요
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed">
              객관식은 빠르게, 서술형은 신중하게.
              교사를 돕는 실무형 AI 채점 시스템으로
              채점 시간은 줄이고 검수와 피드백 품질을 높이세요.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "객관식/단답형 자동채점",
                "서술형 초안 채점 + 교사 검수",
                "문항별 배점 자동 계산 및 합산",
                "성적표·분석 화면으로 자동 연결",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/promo/ai-grading"
              className="inline-flex items-center text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors"
            >
              자세히 보기 →
            </Link>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 sm:p-12 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-sm">AI 자동채점 화면</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Video Player Highlight ── */
function VideoPlayerHighlight() {
  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 sm:p-12 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">🎬</div>
              <p className="text-sm">자체 동영상 플레이어 화면</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-violet-600 bg-violet-50 rounded-full mb-4">
              자체 동영상 플레이어
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              학습 흐름에 맞춘 자체 플레이어로
              <br />
              영상 시청부터 학습 추적까지
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed">
              외부 영상 링크를 붙이는 수준이 아니라,
              학습 흐름까지 설계된 자체 플레이어.
              시청부터 진도 확인, 시험 연결까지 하나의 학습 경험으로.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "이어보기, 배속 조절, 전체화면",
                "학생별 시청 이력 자동 기록",
                "차시 단위 영상 연결",
                "수강 상태 대시보드 제공",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/promo/video-platform"
              className="inline-flex items-center text-violet-600 font-semibold text-sm hover:text-violet-700 transition-colors"
            >
              자세히 보기 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Workflow ── */
const STEPS = [
  { step: "01", title: "학생 등록 및 반 배정", desc: "학생 정보를 등록하고 반에 배정합니다." },
  { step: "02", title: "강의·차시·영상 등록", desc: "수업 구조를 설계하고 영상을 업로드합니다." },
  { step: "03", title: "시험/과제 생성", desc: "문항을 등록하고 배점을 설정합니다." },
  { step: "04", title: "AI 자동채점", desc: "제출과 동시에 자동채점이 실행됩니다." },
  { step: "05", title: "성적·피드백 확인", desc: "결과를 확인하고 학생에게 피드백합니다." },
  { step: "06", title: "메시지·상담 연결", desc: "공지 발송, 개별 상담까지 연결됩니다." },
];

function Workflow() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="사용 흐름"
          title="학원 운영의 모든 과정을 하나로"
          subtitle="도입 후 운영 흐름을 한눈에 확인하세요"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="p-6 rounded-2xl border border-gray-100 bg-white">
              <span className="text-2xl font-extrabold text-blue-100 mb-2 block">{s.step}</span>
              <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing Preview ── */
function PricingPreview() {
  const plans = [
    { name: "Lite", desc: "소형 학원 / 초기 도입", price: "55,000", color: "gray" },
    { name: "Basic", desc: "중형 학원 / 실무 운영", price: "150,000", color: "blue", popular: true },
    { name: "Premium", desc: "대형 학원 / 프리미엄", price: "300,000", color: "violet" },
  ];

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="요금제"
          title="학원 규모에 맞는 플랜을 선택하세요"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`p-6 rounded-2xl bg-white border-2 transition-shadow ${
                p.popular
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : "border-gray-100 hover:shadow-lg"
              }`}
            >
              {p.popular && (
                <span className="inline-block px-2 py-0.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-3">
                  추천
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">{p.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">₩{p.price}</span>
                <span className="text-sm text-gray-400"> / 월</span>
              </div>
              <Link
                to="/promo/pricing"
                className={`block text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  p.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                자세히 보기
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ Summary ── */
const FAQ_ITEMS = [
  { q: "AI 자동채점은 어떤 문제에 적용되나요?", a: "객관식, OX형, 단답형은 자동 채점됩니다. 서술형은 AI 보조 평가 후 교사 검수 구조를 제공합니다." },
  { q: "기존 영상 플랫폼 없이도 운영 가능한가요?", a: "네. 자체 동영상 플레이어를 기본 제공하여 별도 외부 서비스 없이 운영 가능합니다." },
  { q: "학원 규모별 요금제는 어떻게 되나요?", a: "Lite, Basic, Premium 3단계로 구성됩니다. 학원 규모와 필요 기능에 따라 선택하세요." },
  { q: "데모 요청 후 어떤 절차로 진행되나요?", a: "데모 요청 접수 후 담당자가 연락드려 운영 환경에 맞는 시연과 도입 상담을 진행합니다." },
];

function FaqSummary() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="FAQ"
          title="자주 묻는 질문"
        />
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-100 transition-colors"
            >
              <summary className="cursor-pointer font-semibold text-gray-900 text-sm flex items-center justify-between">
                {item.q}
                <span className="text-gray-400 group-open:rotate-180 transition-transform ml-4">▾</span>
              </summary>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/promo/faq" className="text-blue-600 font-semibold text-sm hover:text-blue-700">
            모든 FAQ 보기 →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Page ── */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBadges />
      <ProblemSolution />
      <FeatureCards />
      <AiGradingHighlight />
      <VideoPlayerHighlight />
      <Workflow />
      <PricingPreview />
      <FaqSummary />
      <CtaSection />
    </>
  );
}
