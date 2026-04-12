// PATH: src/app_promo/domains/landing/components/CtaSection.tsx
import { Link } from "react-router-dom";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
}

export default function CtaSection({
  title = "지금 데모를 요청하고 우리 학원에 맞는 도입 방식을 상담받아보세요.",
  subtitle = "무료 상담으로 시작하세요. 운영 환경에 맞춘 맞춤 제안을 드립니다.",
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 py-20 sm:py-24">
      {/* Subtle background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-snug">{title}</h2>
        <p className="text-blue-100 mb-10 text-base sm:text-lg leading-relaxed">{subtitle}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/promo/demo"
            className="px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20 text-[15px]"
          >
            데모 요청
          </Link>
          <Link
            to="/promo/contact"
            className="px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm text-[15px]"
          >
            문의하기
          </Link>
        </div>
      </div>
    </section>
  );
}
