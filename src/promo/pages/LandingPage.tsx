// PATH: src/promo/pages/LandingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";

/* ─── Shared icon ─── */
function ArrowRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   1. HERO
   ═══════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 배경 — 좌우 비대칭 그라데이션으로 시각적 깊이 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50/40" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-blue-100/30 blur-[120px] -translate-y-1/2 translate-x-1/4" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 sm:pt-32 sm:pb-36 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
          수업부터 성적, 안내까지
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            하나의 흐름
          </span>
          으로
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl mx-auto mb-12">
          시험 · 과제 · 성적 · 클리닉 · 메시지를
          <br className="hidden sm:block" />
          끊김 없이 연결하는 학원 운영 SaaS
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/promo/demo"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30"
          >
            데모 요청
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/promo/features"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-gray-700 bg-white/80 backdrop-blur rounded-2xl hover:bg-white transition-all border border-gray-200/80 shadow-sm"
          >
            기능 둘러보기
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   2. VALUE PROPS — 핵심 가치 3개 (히어로 아래 강조 띠)
   ═══════════════════════════════════════════════════════ */

const VALUES = [
  {
    title: "평가 → 후속조치 연결",
    desc: "시험이 끝나면 끝이 아닌, 클리닉·보강까지 자동 연결",
    accent: "from-blue-500 to-blue-600",
  },
  {
    title: "멀티 브랜드 운영",
    desc: "캠퍼스마다 독립 브랜드, 운영은 하나의 시스템",
    accent: "from-indigo-500 to-indigo-600",
  },
  {
    title: "학생앱 · 학부모 안내",
    desc: "결과를 학생이 직접 확인하고 학부모에게 즉시 전달",
    accent: "from-violet-500 to-violet-600",
  },
];

function ValueProps() {
  return (
    <section className="relative -mt-14 z-10 pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg shadow-gray-200/50 border border-gray-100/80"
            >
              {/* 좌측 컬러 바 */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${v.accent}`} />
              <h3 className="text-sm font-bold text-gray-900 mb-1.5 pl-3">{v.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed pl-3">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   3. PAIN POINTS — 공감 → 해결
   ═══════════════════════════════════════════════════════ */

const PAINS = [
  {
    pain: "시험, 성적, 후속조치가 따로 놀아 관리가 번거롭다",
    fix: "평가 → 성적 → 클리닉 → 안내를 하나의 흐름으로 연결",
  },
  {
    pain: "학부모 안내가 늦고 반복 업무가 많다",
    fix: "템플릿 기반 메시지 발송으로 속도와 일관성 확보",
  },
  {
    pain: "선생님마다 운영 방식이 달라 품질이 흔들린다",
    fix: "표준화된 워크플로우로 운영 품질을 일정하게 유지",
  },
];

function PainPoints() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          이런 고민, 익숙하시죠?
        </h2>
        <p className="text-gray-500 text-center mb-14 max-w-md mx-auto">
          기능이 많아도 흐름이 끊기면 운영은 정리되지 않습니다
        </p>

        <div className="space-y-5">
          {PAINS.map((item) => (
            <div
              key={item.pain}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-center p-6 rounded-2xl bg-gray-50/80"
            >
              {/* Pain */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-[15px] text-gray-500 leading-snug">{item.pain}</span>
              </div>

              {/* Arrow */}
              <div className="hidden sm:flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              {/* Fix */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span className="text-[15px] font-medium text-gray-800 leading-snug">{item.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   4. FEATURES — 6개 도메인 (카드에 시각적 무게감 추가)
   ═══════════════════════════════════════════════════════ */

const DOMAINS = [
  { title: "수업 · 학생 관리", desc: "강의/차시/수강생 구조 관리, 학생별 학습 흐름 파악", color: "bg-blue-500", light: "bg-blue-50" },
  { title: "시험 · 과제 · 성적", desc: "시험 생성, 자동채점, 과제 운영, 문항별 분석까지 원스톱", color: "bg-indigo-500", light: "bg-indigo-50" },
  { title: "클리닉 · 보강", desc: "성적 기반 대상자 판단, 클리닉 예약, 후속 학습 연결", color: "bg-rose-500", light: "bg-rose-50" },
  { title: "메시지 · 알림", desc: "템플릿 기반 SMS/알림톡 발송, 학부모·학생 커뮤니케이션", color: "bg-amber-500", light: "bg-amber-50" },
  { title: "커뮤니티 · 학생앱", desc: "Q&A 게시판, 학생 전용 앱에서 성적·과제·영상 확인", color: "bg-emerald-500", light: "bg-emerald-50" },
  { title: "영상 학습", desc: "자체 플레이어, 이어보기, 시청 이력, 수업 연동", color: "bg-violet-500", light: "bg-violet-50" },
];

function Features() {
  return (
    <section className="py-24 bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          운영에 필요한 모든 도메인
        </h2>
        <p className="text-gray-500 text-center mb-14 max-w-lg mx-auto">
          기능을 나열하지 않습니다. 운영 흐름 안에서 자연스럽게 연결됩니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOMAINS.map((d) => (
            <div
              key={d.title}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 border border-gray-100 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300"
            >
              {/* 상단 컬러 바 */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${d.color}`} />
              <div className={`w-9 h-9 rounded-xl ${d.light} flex items-center justify-center mb-4 mt-1`}>
                <div className={`w-3 h-3 rounded-full ${d.color}`} />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2">{d.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/promo/features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            전체 기능 보기
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   5. WORKFLOW — 운영 흐름 시각화
   ═══════════════════════════════════════════════════════ */

const STEPS = [
  { n: "01", title: "수업 운영", desc: "강의·차시 구성" },
  { n: "02", title: "시험·과제", desc: "평가 생성·응시" },
  { n: "03", title: "성적 확인", desc: "자동채점·분석" },
  { n: "04", title: "클리닉·보강", desc: "후속 학습 연결" },
  { n: "05", title: "학부모 안내", desc: "결과 메시지 전달" },
];

function Workflow() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          끊기지 않는 운영 흐름
        </h2>
        <p className="text-gray-500 text-center mb-16 max-w-md mx-auto">
          수업부터 학부모 안내까지, 하나의 워크플로우로 연결됩니다
        </p>

        {/* Desktop: horizontal */}
        <div className="hidden md:block">
          <div className="relative">
            {/* 연결선 */}
            <div className="absolute top-7 left-[10%] right-[10%] h-px bg-gradient-to-r from-blue-200 via-indigo-200 to-violet-200" />

            <div className="grid grid-cols-5 gap-4 relative">
              {STEPS.map((s, i) => (
                <div key={s.n} className="flex flex-col items-center text-center">
                  <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold shadow-md transition-transform hover:scale-105 ${
                    i === 0 ? "bg-blue-600 text-white shadow-blue-200" :
                    i === STEPS.length - 1 ? "bg-indigo-600 text-white shadow-indigo-200" :
                    "bg-white text-gray-700 border-2 border-gray-100 shadow-gray-100"
                  }`}>
                    {s.n}
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-gray-900">{s.title}</h4>
                  <p className="mt-1 text-xs text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical */}
        <div className="md:hidden">
          <div className="relative pl-10 space-y-6">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 to-indigo-200" />
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative flex items-start gap-4">
                <div className={`absolute left-[-25px] z-10 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 || i === STEPS.length - 1
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 border-2 border-gray-100"
                }`}>
                  {s.n}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{s.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   6. WHY US — 차별점 (hero card + 3 supporting)
   ═══════════════════════════════════════════════════════ */

function WhyUs() {
  return (
    <section className="py-24 bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-14">
          왜 학원플러스인가
        </h2>

        {/* Hero 차별점 — 풀 폭 강조 */}
        <div className="mb-6 p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative">
            <div className="inline-flex items-center px-3 py-1 bg-white/15 rounded-full mb-4">
              <span className="text-xs font-semibold text-blue-100">핵심 차별점</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">평가 이후 후속 운영까지 연결</h3>
            <p className="text-blue-100 leading-relaxed max-w-2xl mb-6">
              시험이 끝나면 성적 확인 → 대상자 판단 → 클리닉/보강 → 학부모 안내까지
              하나의 흐름으로 이어집니다. 평가에서 끝나지 않고, 학습 보완까지 완결합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {["시험 완료", "성적 확인", "클리닉 연결", "안내 발송"].map((tag, i) => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/15 rounded-full backdrop-blur-sm">
                  {i > 0 && (
                    <svg className="w-3 h-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Supporting 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-7 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-2">학생앱으로 결과 전달</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              시험 결과, 과제 현황, 성적 추이를
              학생이 직접 확인하는 전용 앱으로 연결됩니다.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-2">멀티 브랜드 독립 운영</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              각 캠퍼스의 로고, 컬러, 운영 구성을 독립적으로 관리.
              하나의 시스템으로 통합 운영합니다.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-2">실무자 중심 UX</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              최소 클릭으로 핵심 기능에 도달.
              나이 불문 누구나 바로 쓸 수 있는 직관적 구조.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   7. LANDING SAMPLES — 미니 프리뷰 형태
   ═══════════════════════════════════════════════════════ */

const TEMPLATES = [
  { name: "Minimal Tutor", mood: "깔끔 · 신뢰", color: "#2563EB", desc: "밝은 배경의 미니멀 디자인" },
  { name: "Premium Dark", mood: "프리미엄 · 세련", color: "#1E3A5F", desc: "다크 톤의 세련된 디자인" },
  { name: "Academic Trust", mood: "체계 · 관리", color: "#4F46E5", desc: "성적·관리 강조 신뢰형" },
  { name: "Program Promo", mood: "홍보 · 활기", color: "#F97316", desc: "프로그램 홍보 중심" },
];

function LandingSamples() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-100 rounded-full mb-5">
          <span className="text-xs font-semibold text-blue-600">NEW</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          선생님 전용 랜딩 페이지
        </h2>
        <p className="text-gray-500 mb-12 max-w-md mx-auto">
          각 학원 도메인에 세련된 브랜드 페이지를 제공합니다.
          비개발자도 쉽게 꾸밀 수 있는 편집 시스템.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
          {TEMPLATES.map((t) => (
            <Link
              key={t.name}
              to="/promo/landing-samples"
              className="group rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all"
            >
              {/* 미니 프리뷰 */}
              <div
                className="h-24 relative"
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}dd)` }}
              >
                {/* 미니 목업 라인 */}
                <div className="absolute inset-x-4 bottom-3 space-y-1.5">
                  <div className="h-1.5 w-12 bg-white/30 rounded-full" />
                  <div className="h-1 w-20 bg-white/20 rounded-full" />
                </div>
              </div>
              <div className="p-3 text-left">
                <span className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {t.name}
                </span>
                <p className="text-[11px] text-gray-400 mt-0.5">{t.mood}</p>
              </div>
            </Link>
          ))}
        </div>

        <Link
          to="/promo/landing-samples"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          모든 샘플 미리보기
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ValueProps />
      <PainPoints />
      <Features />
      <Workflow />
      <WhyUs />
      <LandingSamples />
      <CtaSection />
    </>
  );
}
