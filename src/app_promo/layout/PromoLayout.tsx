// PATH: src/app_promo/layout/PromoLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
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
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import PhoneInquiryLink from "../domains/landing/components/PhoneInquiryLink";
import styles from "./PromoLayout.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/promo", icon: Home, note: "수업 운영 개요" },
  { label: "리포트", path: "/promo/parent-trust", icon: ShieldCheck, note: "상담 전 설명 자료" },
  { label: "기능", path: "/promo/features", icon: ClipboardList, note: "기능과 실제 화면" },
  { label: "영상", path: "/promo/video-platform", icon: PlayCircle, note: "학생앱 복습 영상" },
  { label: "요금제", path: "/promo/pricing", icon: CreditCard, note: "월 비용 기준" },
  { label: "문의", path: "/promo/contact", icon: MessageCircle, note: "도입 상담" },
];

const ACTIVE_ALIASES: Record<string, string[]> = {
  "/promo/features": ["/promo/ai-grading"],
  "/promo/contact": ["/promo/demo"],
};

function isActive(pathname: string, path: string) {
  if (path === "/promo") return pathname === "/promo";
  const direct = pathname === path || pathname.startsWith(`${path}/`);
  const aliased = ACTIVE_ALIASES[path]?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`));
  return direct || Boolean(aliased);
}

function decodeHashId(hash: string) {
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
      <header data-promo-header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.headerInner}>
          <Link to="/promo" className={styles.brand} aria-label="학원플러스 프로모션 홈">
            <span className={styles.brandMark} aria-hidden="true">H</span>
            <span className={styles.brandText}>
              <strong>학원플러스</strong>
              <small>수업 운영</small>
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
            <PhoneInquiryLink className={styles.phoneLink}>
              <PhoneCall size={16} />
              전화 문의
            </PhoneInquiryLink>
            <Link to="/login" className={styles.loginLink}>
              <LogIn size={16} />
              로그인
            </Link>
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
              <strong>학원플러스</strong>
              <small>수업 운영</small>
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
            도입 범위 상담
          </span>
          <p>현재 쓰는 수업 관리 방식을 기준으로 먼저 정리할 업무를 함께 고릅니다.</p>
          <PhoneInquiryLink>
            전화 문의
            <PhoneCall size={16} />
          </PhoneInquiryLink>
          <Link to="/promo/demo">
            데모 요청
            <PanelLeftOpen size={16} />
          </Link>
        </div>
      </aside>
    </>
  );
}

function PromoScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    const id = decodeHashId(location.hash);

    const scrollToHashTarget = () => {
      if (cancelled) return;
      const target = document.getElementById(id);
      if (!target) {
        attempts += 1;
        if (attempts < 12) window.setTimeout(scrollToHashTarget, 80);
        return;
      }

      const header = document.querySelector<HTMLElement>("[data-promo-header]");
      const headerOffset = header?.getBoundingClientRect().height ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - 16;
      window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
    };

    window.requestAnimationFrame(scrollToHashTarget);

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.hash]);

  return null;
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link to="/promo" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">H</span>
            <span className={styles.brandText}>
              <strong>학원플러스</strong>
              <small>수업 운영</small>
            </span>
          </Link>
          <p>출결, 시험, 영상, 알림톡을 한 화면에서 관리하는 학원 운영 도구</p>
          <PhoneInquiryLink className={styles.footerPhone}>전화 문의</PhoneInquiryLink>
        </div>

        <nav aria-label="제품">
          <h2>제품</h2>
          <Link to="/promo/parent-trust">학부모 리포트</Link>
          <Link to="/promo/features">기능 소개</Link>
          <Link to="/promo/video-platform">영상 학습</Link>
          <Link to="/promo/ai-grading">채점 보조</Link>
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
  return (
    <div className={styles.layout}>
      <PromoScrollManager />
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
