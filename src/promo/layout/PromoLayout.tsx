// PATH: src/promo/layout/PromoLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginModal from "../components/LoginModal";

const NAV_ITEMS = [
  { label: "기능", path: "/promo/features" },
  { label: "AI 자동채점", path: "/promo/ai-grading" },
  { label: "동영상 플레이어", path: "/promo/video-platform" },
  { label: "요금제", path: "/promo/pricing" },
  { label: "FAQ", path: "/promo/faq" },
  { label: "문의하기", path: "/promo/contact" },
];

function Header({ onLoginClick }: { onLoginClick: () => void }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/promo" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <span className="text-blue-600">학원</span>플러스
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLoginClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              로그인
            </button>
            <Link
              to="/promo/demo"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              데모 요청
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    location.pathname === item.path
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => { setMobileOpen(false); onLoginClick(); }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 text-left"
                >
                  로그인
                </button>
                <Link
                  to="/promo/demo"
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg text-center"
                >
                  데모 요청
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="font-bold text-lg text-white mb-3">
              <span className="text-blue-400">학원</span>플러스
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              학원 운영과 학습 관리를 하나로 묶는 프리미엄 SaaS
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3">제품</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/promo/features" className="text-sm hover:text-white transition-colors">기능 소개</Link>
              <Link to="/promo/ai-grading" className="text-sm hover:text-white transition-colors">AI 자동채점</Link>
              <Link to="/promo/video-platform" className="text-sm hover:text-white transition-colors">동영상 플레이어</Link>
              <Link to="/promo/pricing" className="text-sm hover:text-white transition-colors">요금제</Link>
            </nav>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3">지원</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/promo/faq" className="text-sm hover:text-white transition-colors">자주 묻는 질문</Link>
              <Link to="/promo/contact" className="text-sm hover:text-white transition-colors">문의하기</Link>
              <Link to="/promo/demo" className="text-sm hover:text-white transition-colors">데모 요청</Link>
            </nav>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3">회사</h4>
            <nav className="flex flex-col gap-2">
              <span className="text-sm">개인정보처리방침</span>
              <span className="text-sm">이용약관</span>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-800 text-sm text-gray-500">
          &copy; {new Date().getFullYear()} 학원플러스. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function PromoLayout() {
  const [loginOpen, setLoginOpen] = useState(false);
  const location = useLocation();

  // /login → /promo 리다이렉트 시 로그인 모달 자동 오픈
  useEffect(() => {
    if ((location.state as any)?.openLogin) {
      setLoginOpen(true);
      // state 소비 후 제거 (뒤로가기 시 모달 다시 열리지 않도록)
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header onLoginClick={() => setLoginOpen(true)} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
