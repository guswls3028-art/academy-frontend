// PATH: src/app_promo/domains/landing/pages/DemoPage.tsx
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const INTEREST_OPTIONS = [
  "학생 관리",
  "시험/과제",
  "AI 자동채점",
  "동영상 플레이어",
  "메시지 기능",
  "상담/클리닉",
];

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    academy_name: "",
    phone: "",
    email: "",
    student_count: "",
    current_workflow: "",
    interests: [] as string[],
    message: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleInterest = (item: string) =>
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter((i) => i !== item)
        : [...prev.interests, item],
    }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: POST /api/v1/promo/demo/ 연동
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section className="py-24 text-center">
        <div className="max-w-lg mx-auto px-4">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">데모 요청이 접수되었습니다</h2>
          <p className="text-gray-500 mb-3">
            담당자가 확인 후 빠르게 연락드리겠습니다.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            보통 1영업일 이내에 연락드리며, 운영 환경에 맞는 시연을 준비합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/promo/features" className="px-6 py-2.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              기능 소개 보기
            </Link>
            <Link to="/promo/pricing" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              요금제 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">데모 요청</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            우리 학원 운영 흐름에 맞는 도입 방식을 상담받아보세요.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학원명 *</label>
                <input
                  type="text"
                  required
                  value={form.academy_name}
                  onChange={(e) => update("academy_name", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="학원 이름"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처 *</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학생 수</label>
                <input
                  type="text"
                  value={form.student_count}
                  onChange={(e) => update("student_count", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="예: 50명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">현재 운영 방식</label>
                <input
                  type="text"
                  value={form.current_workflow}
                  onChange={(e) => update("current_workflow", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="예: 수기 관리, 엑셀, 타 솔루션"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">관심 기능 (복수 선택)</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInterest(opt)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                      form.interests.includes(opt)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">요청 사항</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none"
                placeholder="추가로 궁금한 점이나 요청 사항을 적어주세요."
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              데모 요청하기
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
