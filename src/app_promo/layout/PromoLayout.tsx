// PATH: src/app_promo/layout/PromoLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  CircleHelp,
  ClipboardList,
  CreditCard,
  Home,
  LogIn,
  Menu,
  MessageCircle,
  MousePointer2,
  PanelLeftOpen,
  PhoneCall,
  PlayCircle,
  Sparkles,
  X,
} from "lucide-react";
import LoginModal from "../domains/landing/components/LoginModal";
import { CONSULT_PHONE_DISPLAY, CONSULT_PHONE_TEL } from "../domains/landing/business";
import styles from "./PromoLayout.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/promo", icon: Home, note: "수업 OS 개요" },
  { label: "기능", path: "/promo/features", icon: ClipboardList, note: "핵심 기능·증거 화면" },
  { label: "영상", path: "/promo/video-platform", icon: PlayCircle, note: "학생앱 영상 학습" },
  { label: "요금제", path: "/promo/pricing", icon: CreditCard, note: "월 비용 기준" },
  { label: "FAQ", path: "/promo/faq", icon: CircleHelp, note: "자주 묻는 질문" },
  { label: "문의", path: "/promo/contact", icon: MessageCircle, note: "수업 맞춤 상담" },
];

const ACTIVE_ALIASES: Record<string, string[]> = {
  "/promo/features": ["/promo/ai-grading"],
  "/promo/contact": ["/promo/demo"],
};

type PromoLocationState = {
  openLogin?: boolean;
};

function isActive(pathname: string, path: string) {
  if (path === "/promo") return pathname === "/promo";
  const direct = pathname === path || pathname.startsWith(`${path}/`);
  const aliased = ACTIVE_ALIASES[path]?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`));
  return direct || Boolean(aliased);
}

function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.headerInner}>
          <Link to="/promo" className={styles.brand} aria-label="학원플러스 프로모션 홈">
            <span className={styles.brandMark} aria-hidden="true">H</span>
            <span className={styles.brandText}>
              <strong>HakwonPlus</strong>
              <small>Academy OS</small>
            </span>
          </Link>

          <div className={styles.desktopNavWrap}>
            <nav className={styles.desktopNav} aria-label="프로모션 메뉴">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={isActive(location.pathname, item.path) ? styles.isActive : ""}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={styles.headerActions}>
            <a href={CONSULT_PHONE_TEL} className={styles.phoneLink}>
              <PhoneCall size={16} />
              {CONSULT_PHONE_DISPLAY}
            </a>
            <a href="/login" className={styles.loginLink}>
              <LogIn size={16} />
              로그인
            </a>
            <Link to="/promo/demo" className={styles.demoLink}>
              <MousePointer2 size={16} />
              데모 요청
            </Link>
          </div>

          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            aria-controls="promo-mobile-sidebar"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <nav className={styles.mobileTabs} aria-label="프로모션 빠른 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={isActive(location.pathname, item.path) ? styles.isActive : ""}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <button
        type="button"
        className={`${styles.sidebarBackdrop} ${mobileOpen ? styles.isOpen : ""}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        id="promo-mobile-sidebar"
        className={`${styles.mobileSidebar} ${mobileOpen ? styles.isOpen : ""}`}
        aria-label="프로모션 사이드 메뉴"
      >
        <div className={styles.sidebarHead}>
          <Link to="/promo" className={styles.brand} aria-label="학원플러스 프로모션 홈">
            <span className={styles.brandMark} aria-hidden="true">H</span>
            <span className={styles.brandText}>
              <strong>HakwonPlus</strong>
              <small>Academy OS</small>
            </span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="프로모션 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={isActive(location.pathname, item.path) ? styles.isActive : ""}
              >
                <Icon size={18} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarCta}>
          <span>
            <Sparkles size={16} />
            빠른 수업 상담
          </span>
          <p>현재 수업 방식에 맞는 시작 경로를 제안드립니다. 급하면 바로 전화주세요.</p>
          <a href={CONSULT_PHONE_TEL}>
            {CONSULT_PHONE_DISPLAY}
            <PhoneCall size={16} />
          </a>
          <Link to="/promo/demo">
            데모 요청
            <PanelLeftOpen size={16} />
          </Link>
        </div>
      </aside>
    </>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link to="/promo" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">H</span>
            <span className={styles.brandText}>
              <strong>HakwonPlus</strong>
              <small>Academy OS</small>
            </span>
          </Link>
          <p>수업부터 성적, 안내와 수업 소개 페이지까지 하나의 흐름으로 묶는 강사용 SaaS</p>
          <a href={CONSULT_PHONE_TEL} className={styles.footerPhone}>
            전화 상담 {CONSULT_PHONE_DISPLAY}
          </a>
        </div>

        <nav aria-label="제품">
          <h2>제품</h2>
          <Link to="/promo/features">기능 소개</Link>
          <Link to="/promo/ai-grading">AI 채점</Link>
          <Link to="/promo/video-platform">영상 학습</Link>
        </nav>

        <nav aria-label="상담">
          <h2>상담</h2>
          <Link to="/promo/pricing">요금제</Link>
          <Link to="/promo/demo">데모 요청</Link>
          <Link to="/promo/contact">문의하기</Link>
        </nav>

        <nav aria-label="법적 고지">
          <h2>법적 고지</h2>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/terms">이용약관</Link>
          <Link to="/promo/faq">FAQ</Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>&copy; {new Date().getFullYear()} 학원플러스. All rights reserved.</span>
      </div>
    </footer>
  );
}

export default function PromoLayout() {
  const [loginOpen, setLoginOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const state = location.state as PromoLocationState | null;
    if (state?.openLogin) {
      setLoginOpen(true);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
