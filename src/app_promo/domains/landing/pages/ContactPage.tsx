// PATH: src/app_promo/domains/landing/pages/ContactPage.tsx
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getPromoLeadErrorMessage, submitPromoContactLead } from "../api/promoLead";

const INQUIRY_TYPES = ["가격 문의", "데모 요청", "도입 상담", "기능 문의", "제휴 문의"];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    academy_name: "",
    student_count: "",
    inquiry_type: INQUIRY_TYPES[0],
    message: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await submitPromoContactLead({
        name: form.name,
        phone: form.phone,
        email: form.email,
        academyName: form.academy_name,
        studentCount: form.student_count,
        inquiryType: form.inquiry_type,
        message: form.message,
        website,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getPromoLeadErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <section className="py-24 text-center">
        <div className="max-w-lg mx-auto px-4">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">문의가 접수되었습니다</h2>
          <p className="text-gray-500 mb-6">
            확인 후 빠르게 연락드리겠습니다. 감사합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/promo" className="px-6 py-2.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              홈으로 돌아가기
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">문의하기</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            궁금한 점이나 도입 상담이 필요하시면 아래 양식을 작성해주세요.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-px w-px opacity-0"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  disabled={pending}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처 *</label>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  disabled={pending}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="010-0000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  maxLength={120}
                  disabled={pending}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학원명</label>
                <input
                  type="text"
                  maxLength={80}
                  disabled={pending}
                  value={form.academy_name}
                  onChange={(e) => update("academy_name", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="학원 이름"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학생 수</label>
                <input
                  type="text"
                  maxLength={40}
                  disabled={pending}
                  value={form.student_count}
                  onChange={(e) => update("student_count", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                  placeholder="예: 50명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">문의 유형 *</label>
                <select
                  required
                  disabled={pending}
                  value={form.inquiry_type}
                  onChange={(e) => update("inquiry_type", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm bg-white"
                >
                  {INQUIRY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">문의 내용 *</label>
              <textarea
                required
                rows={5}
                maxLength={1500}
                disabled={pending}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none"
                placeholder="궁금한 점이나 요청 사항을 자유롭게 작성해주세요."
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-wait transition-colors text-sm"
            >
              {pending ? "전송 중..." : "문의 보내기"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
