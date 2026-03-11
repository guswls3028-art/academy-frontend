// PATH: src/promo/pages/VideoPlatformPage.tsx
import SectionHeading from "../components/SectionHeading";
import CtaSection from "../components/CtaSection";

const CORE_FEATURES = [
  "웹 기반 영상 재생",
  "이어보기 (마지막 재생 위치 저장)",
  "배속 조절",
  "재생/일시정지/탐색 바",
  "전체화면",
  "모바일/태블릿 대응",
];

const OPS_FEATURES = [
  "학생별 시청 이력 기록",
  "차시 단위 영상 연결",
  "수업/과제/시험과 연결",
  "수강 상태 확인 (미시청/시청중/완료)",
];

const BIZ_POINTS = [
  { icon: "🎨", title: "브랜딩 일관성", desc: "외부 플랫폼 UI에 종속되지 않고 자체 브랜드 경험을 유지합니다." },
  { icon: "🔗", title: "학습 흐름 유지", desc: "영상 시청에서 과제, 시험까지 제품 내부에서 연결됩니다." },
  { icon: "📊", title: "데이터 연결", desc: "시청 데이터를 성적·진도와 통합하여 학습 현황을 파악합니다." },
  { icon: "⚙️", title: "UX 커스터마이징", desc: "수업 흐름에 맞춘 재생 경험을 제공합니다." },
];

const ADMIN_FEATURES = [
  "강의/차시별 영상 등록",
  "영상 공개 범위 설정",
  "학습 대상자 지정",
  "학생별 시청 현황 대시보드",
];

const STUDENT_FEATURES = [
  "복잡하지 않은 직관적 플레이어 UI",
  "학습에 필요한 최소 기능 위주",
  "다음 차시/이전 차시 자연 이동",
  "시험/과제 안내와 연결",
];

export default function VideoPlatformPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-violet-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-violet-600 bg-violet-100 rounded-full mb-4">
            자체 동영상 플레이어
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            학습 흐름까지 설계된 자체 플레이어
          </h1>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto">
            외부 영상 링크를 붙이는 수준을 넘어,
            시청부터 진도 확인, 시험 연결까지 하나의 학습 경험으로.
          </p>
        </div>
      </section>

      {/* Definition */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-6 rounded-2xl bg-violet-50 border border-violet-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              자체 동영상 플레이어는 단순 영상 재생기가 아니라,
              <strong> 학습 경험과 운영 데이터를 연결하는 학습 인프라</strong>입니다.
            </p>
          </div>
        </div>
      </section>

      {/* Core + Ops Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-white border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-violet-600">▶</span> 필수 기능
              </h3>
              <ul className="space-y-3">
                {CORE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-2xl bg-white border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-blue-600">📊</span> 운영 연동 기능
              </h3>
              <ul className="space-y-3">
                {OPS_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Business Advantages */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="사업적 장점" subtitle="왜 자체 플레이어인가" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BIZ_POINTS.map((b) => (
              <div key={b.title} className="p-6 rounded-2xl bg-white border border-gray-100 text-center">
                <div className="text-4xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{b.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin & Student views */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">관리자 관점</h3>
              <ul className="space-y-3">
                {ADMIN_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700 p-3 rounded-lg bg-gray-50">
                    <span className="text-blue-400">→</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">학생 관점</h3>
              <ul className="space-y-3">
                {STUDENT_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700 p-3 rounded-lg bg-gray-50">
                    <span className="text-violet-400">→</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
