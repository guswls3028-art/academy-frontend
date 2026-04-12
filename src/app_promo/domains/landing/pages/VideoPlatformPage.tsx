// PATH: src/app_promo/domains/landing/pages/VideoPlatformPage.tsx
import CtaSection from "../components/CtaSection";

const PLAYER_FEATURES = [
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

const ADVANTAGES = [
  { title: "브랜딩 일관성", desc: "외부 플랫폼 UI에 종속되지 않고 자체 브랜드 경험을 유지합니다." },
  { title: "학습 흐름 유지", desc: "영상 시청에서 과제, 시험까지 제품 내부에서 연결됩니다." },
  { title: "데이터 연결", desc: "시청 데이터를 성적·진도와 통합하여 학습 현황을 파악합니다." },
  { title: "UX 커스터마이징", desc: "수업 흐름에 맞춘 재생 경험을 제공합니다." },
];

export default function VideoPlatformPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            자체 동영상 플레이어
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            외부 영상 링크를 붙이는 수준을 넘어,
            시청부터 진도 확인, 시험 연결까지 하나의 학습 경험으로.
          </p>
        </div>
      </section>

      {/* Definition */}
      <section className="py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-5 rounded-xl bg-violet-50/60 border border-violet-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              자체 동영상 플레이어는 단순 영상 재생기가 아니라,
              <strong> 학습 경험과 운영 데이터를 연결하는 학습 인프라</strong>입니다.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-7 rounded-2xl bg-white border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-5">플레이어 기능</h3>
              <ul className="space-y-2.5">
                {PLAYER_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-7 rounded-2xl bg-white border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-5">운영 연동</h3>
              <ul className="space-y-2.5">
                {OPS_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-14 bg-gray-50/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">왜 자체 플레이어인가</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {ADVANTAGES.map((a) => (
              <div key={a.title} className="p-6 rounded-xl bg-white border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{a.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
