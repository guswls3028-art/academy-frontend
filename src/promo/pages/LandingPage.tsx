// PATH: src/promo/pages/LandingPage.tsx
import { Link } from "react-router-dom";
import CtaSection from "../components/CtaSection";

/* ─── Shared icon ─── */
function ChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   1. HERO — 자신감 있는 헤드라인 + 핵심 가치 3개
   ═══════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.15] tracking-tight mb-6">
          수업부터 성적, 안내까지
          <br />
          <span className="text-blue-600">하나의 흐름</span>으로
        </h1>

        <p className="text-lg text-gray-500 leading-relaxed max-w-xl mx-auto mb-10">
          시험 · 과제 · 성적 · 클리닉 · 메시지를 끊김 없이 연결하는
          <br className="hidden sm:block" />
          학원 운영 SaaS
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link
            to="/promo/demo"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-[15px] font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            데모 요청
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            to="/promo/features"
            className="inline-flex items-center justify-center px-8 py-3.5 text-[15px] font-semibold text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors border border-gray-200"
          >
            기능 둘러보기
          </Link>
        </div>

        {/* 핵심 가치 3개 — 간결하게 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { title: "평가 → 후속조치 연결", desc: "시험 끝나면 끝이 아닌, 클리닉·보강까지 자동 연결" },
            { title: "멀티 브랜드 운영", desc: "캠퍼스마다 독립 브랜드, 운영은 하나의 시스템" },
            { title: "학생앱 · 학부모 안내", desc: "결과를 학생이 직접 확인하고 학부모에게 즉시 전달" },
          ].map((item) => (
            <div key={item.title} className="text-left p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1.5">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   2. PAIN POINTS — 공감 → 해결 (3개로 압축)
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
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          이런 고민, 익숙하시죠?
        </h2>
        <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
          기능이 많아도 흐름이 끊기면 운영은 정리되지 않습니다
        </p>

        <div className="space-y-4">
          {PAINS.map((item) => (
            <div
              key={item.pain}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-6 rounded-2xl border border-gray-100 bg-gray-50/50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-sm text-gray-500">{item.pain}</span>
              </div>
              <svg className="hidden sm:block w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-800">{item.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   3. FEATURES — 6개 도메인 간결 그리드
   ═══════════════════════════════════════════════════════ */

const DOMAINS = [
  { title: "수업 · 학생 관리", desc: "강의/차시/수강생 구조 관리, 학생별 학습 흐름 파악", color: "bg-blue-600" },
  { title: "시험 · 과제 · 성적", desc: "시험 생성, 자동채점, 과제 운영, 문항별 분석까지 원스톱", color: "bg-indigo-600" },
  { title: "클리닉 · 보강", desc: "성적 기반 대상자 판단, 클리닉 예약, 후속 학습 연결", color: "bg-rose-500" },
  { title: "메시지 · 알림", desc: "템플릿 기반 SMS/알림톡 발송, 학부모·학생 커뮤니케이션", color: "bg-amber-500" },
  { title: "커뮤니티 · 학생앱", desc: "Q&A 게시판, 학생 전용 앱에서 성적·과제·영상 확인", color: "bg-emerald-600" },
  { title: "영상 학습", desc: "자체 플레이어, 이어보기, 시청 이력, 수업 연동", color: "bg-violet-600" },
];

function Features() {
  return (
    <section className="py-20 bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          운영에 필요한 모든 도메인
        </h2>
        <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
          기능을 나열하지 않습니다. 운영 흐름 안에서 자연스럽게 연결됩니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOMAINS.map((d) => (
            <div key={d.title} className="p-6 rounded-2xl bg-white border border-gray-100">
              <div className={`w-2 h-2 rounded-full ${d.color} mb-4`} />
              <h3 className="text-[15px] font-bold text-gray-900 mb-2">{d.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/promo/features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            전체 기능 보기
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   4. WORKFLOW — 운영 흐름 시각화
   ═══════════════════════════════════════════════════════ */

const STEPS = [
  { n: "01", title: "수업 운영" },
  { n: "02", title: "시험·과제" },
  { n: "03", title: "성적 확인" },
  { n: "04", title: "클리닉·보강" },
  { n: "05", title: "학부모 안내" },
];

function Workflow() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          끊기지 않는 운영 흐름
        </h2>
        <p className="text-gray-500 text-center mb-14 max-w-md mx-auto">
          수업부터 학부모 안내까지, 하나의 워크플로우로 연결됩니다
        </p>

        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-center justify-between relative">
          <div className="absolute top-5 left-12 right-12 h-px bg-gray-200" />
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-col items-center text-center relative z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mb-3 ${
                i === 0 ? "bg-blue-600 text-white" :
                i === STEPS.length - 1 ? "bg-indigo-600 text-white" :
                "bg-white text-gray-600 border-2 border-gray-200"
              }`}>
                {s.n}
              </div>
              <span className="text-sm font-semibold text-gray-900">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Mobile: vertical */}
        <div className="md:hidden relative pl-8 space-y-5">
          <div className="absolute left-[14px] top-2 bottom-2 w-px bg-gray-200" />
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative flex items-center gap-4">
              <div className={`relative z-10 w-7 h-7 -ml-[22px] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i === 0 || i === STEPS.length - 1
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border-2 border-gray-200"
              }`}>
                {s.n}
              </div>
              <span className="text-sm font-semibold text-gray-900">{s.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   5. WHY US — 차별점 (4개로 통합)
   ═══════════════════════════════════════════════════════ */

function WhyUs() {
  return (
    <section className="py-20 bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
          왜 학원플러스인가
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">평가 이후 후속 운영까지</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              시험이 끝나면 성적 확인 → 대상자 판단 → 클리닉/보강 → 학부모 안내까지
              하나의 흐름으로 이어집니다.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["시험 완료", "성적 확인", "클리닉 연결", "안내 발송"].map((tag) => (
                <span key={tag} className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">학생앱으로 결과 전달</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              운영 도구에서 끝나지 않습니다. 시험 결과, 과제 현황, 성적 추이를
              학생이 직접 확인하는 전용 앱으로 연결됩니다.
              관리자가 만든 결과를 학생과 학부모가 체감합니다.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">멀티 브랜드 독립 운영</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              각 캠퍼스의 로고, 컬러, 운영 구성을 독립적으로 관리하면서
              하나의 시스템으로 통합 운영합니다.
              캠퍼스 추가나 브랜드 확장에 유연하게 대응합니다.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">실무자 중심 UX</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              자주 쓰는 기능에 최소 클릭으로 도달하고,
              중요한 데이터가 먼저 보이는 화면 설계.
              나이 불문 누구나 바로 쓸 수 있는 직관적 구조입니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   6. LANDING SAMPLES — 간결한 소개
   ═══════════════════════════════════════════════════════ */

function LandingSamples() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center px-3 py-1 bg-blue-50 rounded-full mb-5">
          <span className="text-xs font-semibold text-blue-600">NEW</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          선생님 전용 랜딩 페이지
        </h2>
        <p className="text-gray-500 mb-10 max-w-lg mx-auto">
          각 학원 도메인에 세련된 브랜드 페이지를 제공합니다.
          비개발자도 쉽게 꾸밀 수 있는 편집 시스템.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mb-8">
          {[
            { name: "Minimal Tutor", color: "#2563EB" },
            { name: "Premium Dark", color: "#1E3A5F" },
            { name: "Academic Trust", color: "#4F46E5" },
            { name: "Program Promo", color: "#F97316" },
          ].map((t) => (
            <Link
              key={t.name}
              to="/promo/landing-samples"
              className="group p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-center"
            >
              <div
                className="w-8 h-8 rounded-lg mx-auto mb-2"
                style={{ background: t.color }}
              />
              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                {t.name}
              </span>
            </Link>
          ))}
        </div>

        <Link
          to="/promo/landing-samples"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          모든 샘플 미리보기
          <ChevronRight className="w-3.5 h-3.5" />
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
      <PainPoints />
      <Features />
      <Workflow />
      <WhyUs />
      <LandingSamples />
      <CtaSection />
    </>
  );
}
