// PATH: src/promo/components/CtaSection.tsx
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
    <section className="bg-blue-600 py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{title}</h2>
        <p className="text-blue-100 mb-8 text-lg">{subtitle}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/promo/demo"
            className="px-8 py-3.5 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
          >
            데모 요청
          </Link>
          <Link
            to="/promo/contact"
            className="px-8 py-3.5 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors border border-blue-400"
          >
            문의하기
          </Link>
        </div>
      </div>
    </section>
  );
}
