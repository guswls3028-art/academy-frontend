// PATH: src/app_promo/layout/PromoLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
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
import { ICON } from "@/shared/ui/ds";
import PhoneInquiryLink from "../domains/landing/components/PhoneInquiryLink";
import { capturePromoAttribution } from "../domains/landing/promoAttribution";
import { applyPromoMeta } from "../domains/landing/promoMeta";
import styles from "./PromoLayout.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/promo", icon: Home, note: "처음 보는 분을 위한 안내" },
  { label: "상담 자료", path: "/promo/parent-trust", icon: ShieldCheck, note: "기록으로 설명하기" },
  { label: "기능", path: "/promo/features", icon: ClipboardList, note: "운영·영상·알림톡·홈페이지" },
  { label: "영상", path: "/promo/video-platform", icon: PlayCircle, note: "학생앱 복습 영상" },
  { label: "요금", path: "/promo/pricing", icon: CreditCard, note: "월 요금과 별도 비용" },
  { label: "문의", path: "/promo/contact", icon: MessageCircle, note: "사용 상담" },
];

const ACTIVE_ALIASES: Record<string, string[]> = {
  "/promo/features": ["/promo/ai-grading", "/promo/matchup-ppt"],
  "/promo/contact": ["/promo/demo"],
};

const HAKWONPLUS_ICON = "/tenants/hakwonplus/favicon.png";

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    if (sidebarRef.current) sidebarRef.current.inert = !mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    const trigger = menuButtonRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [mobileOpen]);

  return (
    <>
      <header data-promo-header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.headerInner}>
          <button
            type="button"
            ref={menuButtonRef}
            className={styles.mobileMenuButton}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            aria-controls="promo-mobile-sidebar"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={ICON.lg} /> : <Menu size={ICON.lg} />}
          </button>

          <Link to="/promo" className={styles.brand} aria-label="학원플러스 프로모션 홈">
            <span className={styles.brandMark} aria-hidden="true">
              <img src={HAKWONPLUS_ICON} alt="" width={64} height={64} />
            </span>
            <span className={styles.brandText}>
              <strong>학원플러스</strong>
              <small>학원 관리</small>
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
                    <Icon size={ICON.sm} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={styles.headerActions}>
            <PhoneInquiryLink className={styles.phoneLink}>
              <PhoneCall size={ICON.sm} />
              전화 문의
            </PhoneInquiryLink>
            <Link to="/login" className={styles.loginLink}>
              <LogIn size={ICON.sm} />
              로그인
            </Link>
            <Link to="/promo/demo" className={styles.demoLink}>
              <MousePointer2 size={ICON.sm} />
              내 자료로 데모
            </Link>
          </div>
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
                <Icon size={ICON.sm} />
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
        ref={sidebarRef}
        id="promo-mobile-sidebar"
        className={`${styles.mobileSidebar} ${mobileOpen ? styles.isOpen : ""}`}
        aria-label="프로모션 사이드 메뉴"
        aria-hidden={!mobileOpen}
      >
        <div className={styles.sidebarHead}>
          <Link to="/promo" className={styles.brand} aria-label="학원플러스 프로모션 홈">
            <span className={styles.brandMark} aria-hidden="true">
              <img src={HAKWONPLUS_ICON} alt="" width={64} height={64} />
            </span>
            <span className={styles.brandText}>
              <strong>학원플러스</strong>
              <small>학원 관리</small>
            </span>
          </Link>
          <button ref={closeButtonRef} type="button" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기">
            <X size={ICON.md} />
          </button>
        </div>

        <div className={styles.sidebarBody} data-testid="promo-mobile-sidebar-scroll">
          <nav className={styles.sidebarNav} aria-label="프로모션 메뉴">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive(location.pathname, item.path) ? styles.isActive : ""}
                >
                  <Icon size={ICON.md} />
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
              <Sparkles size={ICON.sm} />
              내 수업 기준으로 확인
            </span>
            <p>현재 수업과 관리 방식을 기준으로 필요한 화면만 보여드립니다.</p>
            <Link to="/promo/demo">
              내 자료로 데모 요청
              <PanelLeftOpen size={ICON.sm} />
            </Link>
            <PhoneInquiryLink>
              전화 문의
              <PhoneCall size={ICON.sm} />
            </PhoneInquiryLink>
          </div>
        </div>
      </aside>
    </>
  );
}

function PromoDocumentManager() {
  const location = useLocation();

  useEffect(() => {
    applyPromoMeta(location.pathname);
    capturePromoAttribution(location.search);
  }, [location.pathname, location.search]);

  return null;
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
    const correctionTimers: number[] = [];
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
    [160, 480, 960].forEach((delay) => {
      correctionTimers.push(window.setTimeout(scrollToHashTarget, delay));
    });

    return () => {
      cancelled = true;
      correctionTimers.forEach((timer) => window.clearTimeout(timer));
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
            <span className={styles.brandMark} aria-hidden="true">
              <img src={HAKWONPLUS_ICON} alt="" width={64} height={64} />
            </span>
            <span className={styles.brandText}>
              <strong>학원플러스</strong>
              <small>학원 관리</small>
            </span>
          </Link>
          <p>수업과 학생 관리, 학부모 안내와 학원 홈페이지를 한곳에서 이어갑니다.</p>
          <PhoneInquiryLink className={styles.footerPhone}>전화 문의</PhoneInquiryLink>
        </div>

        <nav aria-label="주요 기능">
          <h2>주요 기능</h2>
          <Link to="/promo/features">기능 소개</Link>
          <Link to="/promo/video-platform">영상 학습</Link>
          <Link to="/promo/features#communication">알림톡 안내</Link>
          <Link to="/promo/landing-samples">학원 홈페이지</Link>
          <Link to="/promo/matchup-ppt">매치업·칠판용 PPT</Link>
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
      <PromoDocumentManager />
      <PromoScrollManager />
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
