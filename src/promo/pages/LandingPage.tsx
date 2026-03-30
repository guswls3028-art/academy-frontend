// PATH: src/promo/pages/LandingPage.tsx
import { Link } from "react-router-dom";
import SectionHeading from "../components/SectionHeading";
import CtaSection from "../components/CtaSection";

/* ═══════════════════════════════════════════════════════
   Icons — lightweight inline SVGs for premium feel
   ═══════════════════════════════════════════════════════ */

function IconUsers({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}
function IconClipboard({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  );
}
function IconChart({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}
function IconHeart({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  );
}
function IconEnvelope({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}
function IconPlay({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
    </svg>
  );
}
function IconShield({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}
function IconBolt({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}
function IconBuilding({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  );
}
function IconCursor({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
    </svg>
  );
}
function IconCheck({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
function IconArrowRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}
function IconAcademic({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════
   1. HERO
   ═══════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-50/60 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-indigo-50/40 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-blue-700">프리미엄 학원 운영 SaaS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-gray-900 leading-[1.2] tracking-tight mb-6">
              학원 운영의 흐름을
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                하나의 시스템
              </span>
              으로 정리하세요
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
              수업, 시험, 과제, 성적, 클리닉, 메시지까지
              <br className="hidden sm:block" />
              끊김 없이 이어지는 학원 운영 SaaS.
              <br className="hidden sm:block" />
              선생님은 더 쉽게, 학생과 학부모는 더 명확하게.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/promo/demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-600/20"
              >
                데모 요청
                <IconArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/promo/features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-gray-700 bg-white rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all border border-gray-200 shadow-sm"
              >
                기능 둘러보기
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6 mt-10 pt-8 border-t border-gray-100">
              {[
                { label: "멀티 브랜드 운영", icon: <IconBuilding className="w-4 h-4" /> },
                { label: "실시간 데이터 연동", icon: <IconBolt className="w-4 h-4" /> },
                { label: "보안 인프라", icon: <IconShield className="w-4 h-4" /> },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-sm text-gray-400">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Product mockup composition */}
          <div className="relative hidden lg:block">
            <div className="relative">
              {/* Main dashboard mockup */}
              <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="h-6 bg-gray-100 rounded-md max-w-xs mx-auto" />
                  </div>
                </div>
                {/* Dashboard content skeleton */}
                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="h-5 w-32 bg-gray-100 rounded" />
                      <div className="h-3 w-48 bg-gray-50 rounded" />
                    </div>
                    <div className="h-8 w-24 bg-blue-50 rounded-lg" />
                  </div>
                  {/* Stat cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "수강생", color: "bg-blue-500" },
                      { label: "오늘 수업", color: "bg-emerald-500" },
                      { label: "진행 시험", color: "bg-amber-500" },
                      { label: "메시지", color: "bg-violet-500" },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100/60">
                        <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
                        <div className="text-xs text-gray-400 mb-0.5">{s.label}</div>
                        <div className="text-lg font-bold text-gray-800">—</div>
                      </div>
                    ))}
                  </div>
                  {/* Table skeleton */}
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100" />
                        <div className="flex-1 space-y-1">
                          <div className={`h-3 bg-gray-100 rounded`} style={{ width: `${60 + i * 12}%` }} />
                          <div className="h-2 w-20 bg-gray-50 rounded" />
                        </div>
                        <div className="h-6 w-16 bg-emerald-50 rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating card — Grade result (UI 예시) */}
              <div className="absolute -bottom-6 -left-8 bg-white rounded-xl shadow-xl shadow-gray-200/40 border border-gray-100 p-4 w-52">
                <div className="text-xs text-gray-400 mb-2">성적 추이</div>
                <div className="flex items-end gap-1.5 mb-2">
                  {[40, 65, 55, 78, 90, 85, 92].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-blue-400/80"
                      style={{ height: h * 0.4, transition: "height 0.3s" }}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400">시각적 성적 분석</div>
              </div>

              {/* Floating card — Message feature */}
              <div className="absolute -top-4 -right-6 bg-white rounded-xl shadow-xl shadow-gray-200/40 border border-gray-100 p-4 w-56">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                    <IconEnvelope className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-800">메시지 발송</div>
                    <div className="text-[10px] text-gray-400">학부모 일괄 안내 가능</div>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-emerald-400 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   2. PROBLEM → SOLUTION
   ═══════════════════════════════════════════════════════ */

const PROBLEMS = [
  {
    problem: "시험, 과제, 성적이 따로 놀아서 관리가 번거롭다",
    solution: "수업 → 평가 → 성적 → 후속조치까지 하나의 흐름으로 연결",
  },
  {
    problem: "학생 상태를 한눈에 파악하기 어렵다",
    solution: "학생별 학습 이력, 성적, 출결을 한 화면에서 확인",
  },
  {
    problem: "학부모 안내가 늦고 반복 업무가 많다",
    solution: "템플릿 기반 메시지 발송으로 안내 속도와 일관성 확보",
  },
  {
    problem: "기능은 많아도 실제 현장에서 쓰기 어렵다",
    solution: "실무자가 바로 이해할 수 있는 구조와 화면 구성",
  },
  {
    problem: "선생님마다 관리 방식이 달라 운영 품질이 흔들린다",
    solution: "표준화된 워크플로우로 운영 품질을 일정하게 유지",
  },
  {
    problem: "평가 후 후속 조치가 연결되지 않는다",
    solution: "성적 기반 클리닉/보강 연결로 학습 보완까지 완결",
  },
];

function ProblemSolution() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="학원 운영의 현실"
          title="이런 고민, 익숙하시죠?"
          subtitle="기능이 많아도 흐름이 끊기면 운영은 정리되지 않습니다"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROBLEMS.map((item) => (
            <div
              key={item.problem}
              className="group relative p-6 rounded-2xl bg-white border border-gray-100 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50/50 transition-all duration-300"
            >
              {/* Problem */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center mt-0.5">
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-[15px] text-gray-500 leading-snug">{item.problem}</p>
              </div>
              {/* Solution */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                  <IconCheck className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-[15px] font-medium text-gray-800 leading-snug">{item.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   3. FEATURE GRID (6 운영 도메인)
   ═══════════════════════════════════════════════════════ */

const FEATURE_BLOCKS = [
  {
    icon: <IconUsers className="w-6 h-6" />,
    title: "수업 · 학생 운영",
    desc: "강의, 차시, 수강생 구조를 체계적으로 관리하고 학생별 학습 흐름을 한눈에 파악합니다.",
    details: ["강의/차시/수강생 구조 관리", "학생별 상태 대시보드", "운영자·강사 시점 현황 파악"],
    color: "blue",
  },
  {
    icon: <IconClipboard className="w-6 h-6" />,
    title: "시험 · 과제 · 성적",
    desc: "시험 생성부터 과제 운영, 성적 기록, 결과 제공, 문항별 분석까지 원스톱으로 처리합니다.",
    details: ["시험 생성 및 자동채점", "과제 운영 및 제출 관리", "문항별 분석과 결과 시각화"],
    color: "indigo",
  },
  {
    icon: <IconHeart className="w-6 h-6" />,
    title: "클리닉 · 보강 · 후속조치",
    desc: "성적 결과를 기반으로 대상자를 판단하고 클리닉/보강 흐름을 연결합니다.",
    details: ["성적 기반 대상자 자동 판단", "클리닉 예약 및 관리", "학습 보완 흐름 연결"],
    color: "rose",
  },
  {
    icon: <IconEnvelope className="w-6 h-6" />,
    title: "메시지 · 알림",
    desc: "템플릿 기반 발송, 상황별 안내, 운영자가 쉽게 쓰는 메시지 인터페이스를 제공합니다.",
    details: ["템플릿 기반 메시지 발송", "상황별 안내 자동화 기반", "학부모·학생 커뮤니케이션"],
    color: "amber",
  },
  {
    icon: <IconAcademic className="w-6 h-6" />,
    title: "커뮤니티 · 학생 경험",
    desc: "학생·강사 소통, 공지, Q&A 게시판과 학생앱을 통한 학습 경험을 강화합니다.",
    details: ["학생/강사 소통 게시판", "공지 및 Q&A 운영", "학생앱 학습 경험"],
    color: "emerald",
  },
  {
    icon: <IconPlay className="w-6 h-6" />,
    title: "콘텐츠 · 확장 기능",
    desc: "자체 동영상 플레이어, 학습자료, 부가 기능으로 학원의 콘텐츠 역량을 확장합니다.",
    details: ["자체 동영상 플레이어", "학습자료 관리", "도구 및 부가 기능"],
    color: "violet",
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; bgLight: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", bgLight: "bg-blue-50/50" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", bgLight: "bg-indigo-50/50" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100", bgLight: "bg-rose-50/50" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", bgLight: "bg-amber-50/50" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", bgLight: "bg-emerald-50/50" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100", bgLight: "bg-violet-50/50" },
};

function FeatureGrid() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="핵심 기능"
          title="학원 운영에 필요한 모든 도메인을 하나로"
          subtitle="기능을 나열하지 않습니다. 운영 흐름 안에서 자연스럽게 연결됩니다."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_BLOCKS.map((f) => {
            const c = COLOR_MAP[f.color];
            return (
              <div
                key={f.title}
                className="group p-7 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300"
              >
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${c.bg} ${c.text} mb-5`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{f.desc}</p>
                <ul className="space-y-2">
                  {f.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-gray-600">
                      <IconCheck className={`w-4 h-4 ${c.text} flex-shrink-0`} />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   4. WORKFLOW (운영 흐름 — 가로 step)
   ═══════════════════════════════════════════════════════ */

const WORKFLOW_STEPS = [
  { step: "01", title: "수업 운영", desc: "강의와 차시를 구성하고 학생을 배정합니다" },
  { step: "02", title: "시험 · 과제 진행", desc: "평가를 생성하고 학생이 응시/제출합니다" },
  { step: "03", title: "성적 확인", desc: "자동채점 결과와 문항별 분석을 확인합니다" },
  { step: "04", title: "대상자 판단", desc: "성적 기반으로 보강/클리닉 대상을 식별합니다" },
  { step: "05", title: "클리닉 · 보강", desc: "부족 항목에 대한 후속 학습을 연결합니다" },
  { step: "06", title: "학부모 안내", desc: "결과와 후속 조치를 메시지로 전달합니다" },
  { step: "07", title: "학생앱 확인", desc: "학생이 직접 결과를 확인하고 학습합니다" },
];

function Workflow() {
  return (
    <section className="py-20 sm:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="운영 흐름"
          title="기능이 아니라 운영의 흐름을 연결합니다"
          subtitle="수업부터 학생 피드백까지, 끊기지 않는 하나의 워크플로우"
        />

        {/* Desktop: horizontal connected steps */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-indigo-200" />

            <div className="grid grid-cols-7 gap-4 relative">
              {WORKFLOW_STEPS.map((s, i) => (
                <div key={s.step} className="flex flex-col items-center text-center">
                  {/* Step circle */}
                  <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-sm font-bold shadow-md transition-transform hover:scale-105 ${
                    i === 0 ? "bg-blue-600 text-white shadow-blue-200" :
                    i === WORKFLOW_STEPS.length - 1 ? "bg-indigo-600 text-white shadow-indigo-200" :
                    "bg-white text-gray-700 border-2 border-blue-100 shadow-gray-100"
                  }`}>
                    {s.step}
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-gray-900">{s.title}</h4>
                  <p className="mt-1 text-xs text-gray-400 leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: vertical timeline */}
        <div className="lg:hidden">
          <div className="relative pl-8 space-y-6">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-200 to-indigo-200" />
            {WORKFLOW_STEPS.map((s, i) => (
              <div key={s.step} className="relative flex items-start gap-4">
                <div className={`relative z-10 w-7 h-7 -ml-5 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 || i === WORKFLOW_STEPS.length - 1
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 border-2 border-blue-100"
                }`}>
                  {s.step}
                </div>
                <div className="pb-2">
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
   5. ROLE-BASED SECTION
   ═══════════════════════════════════════════════════════ */

const ROLES = [
  {
    role: "원장 · 운영자",
    desc: "전체 운영 현황을 한눈에 파악하고, 시험/성적/메시지를 관리하며, 표준화된 운영 체계를 구축합니다.",
    points: ["전체 운영 대시보드", "시험·성적·메시지 통합 관리", "운영 표준화 및 품질 일관성"],
    icon: <IconBuilding className="w-6 h-6" />,
    color: "blue",
  },
  {
    role: "강사",
    desc: "수업 운영에 집중하면서 성적 확인, 과제/시험 관리, 학생 상태 파악을 빠르게 처리합니다.",
    points: ["성적 확인 및 분석", "과제·시험 관리", "학생 상태 즉시 파악"],
    icon: <IconAcademic className="w-6 h-6" />,
    color: "indigo",
  },
  {
    role: "조교",
    desc: "보조 운영과 반복 업무를 효율적으로 처리하고, 메시지 발송과 관리를 보조합니다.",
    points: ["보조 운영 업무 처리", "반복 업무 효율화", "메시지·관리 보조"],
    icon: <IconCursor className="w-6 h-6" />,
    color: "emerald",
  },
  {
    role: "학생 · 학부모",
    desc: "시험 결과, 과제 현황, 성적 추이를 직접 확인하고, 더 명확한 피드백을 경험합니다.",
    points: ["시험 결과 즉시 확인", "과제 현황 확인", "체계적인 성적 피드백"],
    icon: <IconChart className="w-6 h-6" />,
    color: "violet",
  },
];

const ROLE_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  violet: { bg: "bg-violet-50", text: "text-violet-600" },
};

function RoleSection() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="사용자별 가치"
          title="모든 사용자가 자신의 역할에 맞게 더 쉽게"
          subtitle="원장부터 학생까지, 각자 필요한 화면으로 연결됩니다"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map((r) => {
            const c = ROLE_COLOR_MAP[r.color];
            return (
              <div
                key={r.role}
                className="p-7 rounded-2xl bg-white border border-gray-100 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center`}>
                    {r.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{r.role}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{r.desc}</p>
                <ul className="space-y-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
                      <IconCheck className={`w-4 h-4 ${c.text} flex-shrink-0`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   6. BRAND / SCALABILITY
   ═══════════════════════════════════════════════════════ */

function BrandSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-6">
              <span className="text-xs font-semibold text-indigo-600">브랜드 확장</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 leading-snug">
              하나의 시스템으로
              <br />
              여러 브랜드를 독립 운영
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              각 캠퍼스나 브랜드에 맞는 구성을 유지하면서
              하나의 시스템 기반으로 확장할 수 있습니다.
              각 학원의 정체성은 그대로, 운영 효율은 하나로.
            </p>
            <ul className="space-y-4">
              {[
                { title: "독립 브랜드 운영", desc: "학원별 로고, 컬러, 운영 구성을 독립적으로 관리" },
                { title: "통합 운영 기반", desc: "하나의 시스템으로 여러 학원의 운영 데이터를 관리" },
                { title: "확장 가능한 구조", desc: "캠퍼스 추가, 브랜드 확장에 유연하게 대응" },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mt-0.5">
                    <IconCheck className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{item.title}</span>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual — Brand concept cards (실제 학원명 아님) */}
          <div className="space-y-4">
            {[
              { label: "A 학원", color: "from-blue-500 to-blue-600", initial: "A" },
              { label: "B 학원", color: "from-emerald-500 to-teal-600", initial: "B" },
              { label: "C 학원", color: "from-violet-500 to-purple-600", initial: "C" },
            ].map((brand) => (
              <div
                key={brand.label}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                  {brand.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{brand.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">독립 브랜드 운영</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="text-gray-400">각 학원별 독립 구성</span>
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
   7. UX ADVANTAGES
   ═══════════════════════════════════════════════════════ */

const UX_POINTS = [
  {
    icon: <IconBolt className="w-5 h-5" />,
    title: "빠른 진입",
    desc: "자주 쓰는 기능에 최소 클릭으로 도달하는 구조",
  },
  {
    icon: <IconChart className="w-5 h-5" />,
    title: "큰 정보 우선순위",
    desc: "중요한 데이터가 먼저 보이는 화면 설계",
  },
  {
    icon: <IconShield className="w-5 h-5" />,
    title: "명확한 상태값",
    desc: "모호한 상태 없이 현재 진행 상황을 정확하게 표시",
  },
  {
    icon: <IconCursor className="w-5 h-5" />,
    title: "반복작업 감소",
    desc: "템플릿, 일괄 처리, 자동화로 반복 업무를 줄여줍니다",
  },
];

function UxSection() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full mb-4">
            <span className="text-xs font-semibold text-blue-600">사용 경험</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            복잡한 기능도 익숙한 흐름으로
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            나이 있는 실무자도 쉽게 사용할 수 있도록, 실제 업무 속도를 높이는 화면을 설계했습니다
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {UX_POINTS.map((item) => (
            <div
              key={item.title}
              className="text-center p-7 rounded-2xl bg-white border border-gray-100 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-4">
                {item.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   8. DIFFERENTIATION — Key strengths
   ═══════════════════════════════════════════════════════ */

function Differentiation() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="차별점"
          title="단순한 관리 프로그램이 아닙니다"
          subtitle="학원플러스가 다른 이유"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Differentiation 1 */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/50">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100/60 rounded-full mb-4">
              <span className="text-xs font-semibold text-blue-700">핵심 차별점</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">평가 이후 후속 운영까지 연결</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              시험이 끝나면 성적 확인 → 대상자 판단 → 클리닉/보강 연결 → 학부모 안내까지
              하나의 흐름으로 이어집니다. 평가에서 끝나지 않고, 학습 보완까지 완결합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {["시험 완료", "성적 확인", "대상자 판단", "클리닉 연결", "안내 발송"].map((tag, i) => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-white text-gray-600 rounded-full border border-blue-100">
                  {i > 0 && <IconArrowRight className="w-3 h-3 text-blue-300" />}
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Differentiation 2 */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50/50 border border-violet-100/50">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100/60 rounded-full mb-4">
              <span className="text-xs font-semibold text-violet-700">학생 경험</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">학생앱까지 이어지는 결과 경험</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              운영 도구에서 끝나지 않습니다. 시험 결과, 과제 현황, 성적 추이를
              학생이 직접 확인하는 전용 앱으로 연결됩니다. 관리자가 만든 결과를
              학생과 학부모가 체감합니다.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <IconChart className="w-5 h-5 text-violet-600" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-800">학생 전용 모바일 앱</div>
                <div className="text-gray-500 text-xs">성적, 시험, 과제, 영상 — 한 곳에서</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   9. TRUST SECTION
   ═══════════════════════════════════════════════════════ */

function TrustSection() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <SectionHeading
          badge="신뢰"
          title="실제 현장을 위해 설계된 시스템"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <IconShield className="w-5 h-5" />, title: "운영 흐름 중심 설계", desc: "실제 학원 운영 시나리오를 기반으로 기능을 구성했습니다" },
            { icon: <IconUsers className="w-5 h-5" />, title: "전체 사용자 경험 고려", desc: "원장, 강사, 조교, 학생, 학부모 모두의 관점을 반영합니다" },
            { icon: <IconBuilding className="w-5 h-5" />, title: "확장 가능한 구조", desc: "브랜드 추가, 캠퍼스 확장에 유연하게 대응합니다" },
            { icon: <IconBolt className="w-5 h-5" />, title: "지속적인 개선", desc: "실사용 피드백을 반영하여 지속적으로 업데이트됩니다" },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl bg-white border border-gray-100">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-600 mb-4">
                {item.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1.5">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   10. LANDING SAMPLES PROMO
   ═══════════════════════════════════════════════════════ */

function LandingSamplesPromo() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto text-center">
        <SectionHeading
          badge="NEW"
          title="선생님 전용 랜딩 페이지"
          subtitle="각 선생님 도메인에 세련된 브랜드 랜딩 페이지를 제공합니다. 비개발자도 쉽게 꾸밀 수 있는 구조화된 편집 시스템."
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {[
            { name: "Minimal Tutor", mood: "깔끔 · 신뢰", color: "#2563EB", desc: "밝은 배경과 넓은 여백의 미니멀 디자인" },
            { name: "Premium Dark", mood: "프리미엄 · 세련", color: "#1E3A5F", desc: "다크 톤의 세련된 프리미엄 디자인" },
            { name: "Academic Trust", mood: "체계 · 관리", color: "#4F46E5", desc: "성적·관리 시스템을 강조하는 신뢰형" },
            { name: "Program Promo", mood: "홍보 · 활기", color: "#F97316", desc: "프로그램 홍보와 CTA 중심의 활기찬 디자인" },
          ].map((t) => (
            <Link
              key={t.name}
              to="/promo/landing-samples"
              className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:shadow-lg hover:border-slate-300 transition-all text-left no-underline group"
            >
              <div className="relative" style={{ width: 48, height: 48, borderRadius: 12, background: t.color, flexShrink: 0 }}>
                <svg className="absolute inset-0 m-auto text-white/80" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.mood}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.desc}</p>
              </div>
              <svg className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          ))}
        </div>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/promo/landing-samples"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white transition-all hover:shadow-lg hover:shadow-blue-600/25"
            style={{ background: "linear-gradient(135deg, #2563EB, #4F46E5)" }}
          >
            모든 샘플 미리보기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
          <p className="text-xs text-slate-400">설정에서 바로 적용 가능</p>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   11. FINAL CTA (override defaults)
   ═══════════════════════════════════════════════════════ */

function FinalCta() {
  return (
    <CtaSection
      title="학원 운영을 하나의 시스템으로 정리할 준비가 되셨나요?"
      subtitle="무료 상담으로 시작하세요. 학원 운영 환경에 맞는 도입 방식을 제안드립니다."
    />
  );
}


/* ═══════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <FeatureGrid />
      <Workflow />
      <RoleSection />
      <BrandSection />
      <Differentiation />
      <UxSection />
      <TrustSection />
      <LandingSamplesPromo />
      <FinalCta />
    </>
  );
}
