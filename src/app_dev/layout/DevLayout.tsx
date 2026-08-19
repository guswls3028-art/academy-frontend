import { useState, type ComponentType } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
  Command,
  CreditCard,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import { logout } from "@/auth/api/auth.api";
import { useProgram } from "@/shared/program";
import {
  PRIMARY_APP_ORIGIN,
  isDeveloperConsoleHost,
} from "@/shared/constants/origins";
import { CommandPalette } from "@dev/shared/components/CommandPalette";
import { useCommandPaletteHotkey } from "@dev/shared/components/useCommandPaletteHotkey";
import { useDevPwa } from "@dev/shared/hooks/useDevPwa";
import s from "./DevLayout.module.css";

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "개요",
    items: [
      { to: "/dev/dashboard", label: "운영 대시보드", description: "핵심 상태와 우선 조치", icon: LayoutDashboard },
    ],
  },
  {
    label: "핵심 운영",
    items: [
      { to: "/dev/tenants", label: "테넌트", description: "계정·도메인·사용량", icon: Building2 },
      { to: "/dev/billing", label: "결제", description: "구독·인보이스·입금", icon: CreditCard },
      { to: "/dev/inbox", label: "문의 운영함", description: "도입·버그·개선 의견", icon: Inbox },
    ],
  },
  {
    label: "분석과 시스템",
    items: [
      { to: "/dev/product-analytics", label: "기능 사용 신호", description: "방문·참여·완료", icon: BarChart3 },
      { to: "/dev/automation", label: "자동화", description: "감사 로그·크론", icon: Workflow },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
const MOBILE_PRIMARY = NAV_ITEMS.filter((item) =>
  ["/dev/dashboard", "/dev/tenants", "/dev/inbox"].includes(item.to),
);

export default function DevLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { program } = useProgram();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(setPaletteOpen);
  useDevPwa();

  const productionConsole = isDeveloperConsoleHost();
  const operationsConsoleHref = productionConsole
    ? `${PRIMARY_APP_ORIGIN}/workspace`
    : "/workspace";

  // 백엔드 OWNER_TENANT_ID(SSOT). isPlatformAdmin 미지원 백엔드는 tenantCode로 폴백.
  if (program) {
    const allowed = program.isPlatformAdmin !== undefined
      ? program.isPlatformAdmin
      : program.tenantCode === "hakwonplus" || program.tenantCode === "9999";
    if (!allowed) {
      return <Navigate to="/workspace" replace />;
    }
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const currentItem = NAV_ITEMS.find((item) => isActive(item.to)) ?? NAV_ITEMS[0];
  const secondaryRouteActive = NAV_ITEMS.some(
    (item) => !MOBILE_PRIMARY.includes(item) && isActive(item.to),
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar} aria-label="개발자 콘솔 주 메뉴">
        <div className={s.sidebarBrand}>
          <div className={s.brandMark} aria-hidden>H+</div>
          <div className={s.brandCopy}>
            <strong>Academy Control</strong>
            <span>Platform operations</span>
          </div>
          <span className={s.brandTag}>DEV</span>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={s.paletteButton}
          title="글로벌 검색 (Cmd/Ctrl+K)"
        >
          <Search size={16} strokeWidth={1.8} />
          <span className={s.paletteLabel}>테넌트·사용자 검색</span>
          <kbd className={s.paletteShortcut}><Command size={10} /> K</kbd>
        </button>

        <nav className={s.sidebarNav}>
          {NAV_SECTIONS.map((section) => (
            <div className={s.navSection} key={section.label}>
              <div className={s.navSectionLabel}>{section.label}</div>
              {section.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`${s.navItem} ${isActive(item.to) ? s.navItemActive : ""}`}
                  aria-current={isActive(item.to) ? "page" : undefined}
                >
                  <item.icon className={s.navIcon} strokeWidth={1.8} />
                  <span className={s.navCopy}>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  {isActive(item.to) && <ChevronRight className={s.navChevron} aria-hidden />}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className={s.sidebarFooter}>
          <a href={operationsConsoleHref} className={s.utilityLink}>
            <ExternalLink size={16} strokeWidth={1.8} />
            운영 콘솔 열기
          </a>
          <button type="button" className={s.utilityLink} onClick={handleLogout}>
            <LogOut size={16} strokeWidth={1.8} />
            로그아웃
          </button>
        </div>
      </aside>

      <header className={s.mobileTopBar}>
        <div className={s.mobileTopLeft}>
          <div className={s.brandMark} aria-hidden>H+</div>
          <div className={s.mobileTitle}>
            <strong>{currentItem.label}</strong>
            <span>Academy Control</span>
          </div>
        </div>
        <div className={s.mobileTopActions}>
          <button
            type="button"
            className={s.mobileIconButton}
            onClick={() => setPaletteOpen(true)}
            aria-label="테넌트·사용자 검색"
          >
            <Search size={19} />
          </button>
          <button
            type="button"
            className={s.mobileIconButton}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "전체 메뉴 닫기" : "전체 메뉴 열기"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className={s.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
          <nav className={s.mobileMenu} onClick={(event) => event.stopPropagation()} aria-label="전체 개발자 메뉴">
            <div className={s.mobileMenuHeader}>
              <span>전체 메뉴</span>
              <small>플랫폼 운영 도구</small>
            </div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={s.mobileMenuItem}
                data-active={isActive(item.to) ? "true" : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className={s.navIcon} strokeWidth={1.8} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <ChevronRight size={16} aria-hidden />
              </Link>
            ))}
            <div className={s.mobileUtilityLinks}>
              <a href={operationsConsoleHref} className={s.mobileMenuItem}>
                <ExternalLink className={s.navIcon} />
                <span><strong>운영 콘솔</strong><small>업무 화면으로 이동</small></span>
              </a>
              <button type="button" className={s.mobileMenuItem} onClick={handleLogout}>
                <LogOut className={s.navIcon} />
                <span><strong>로그아웃</strong><small>현재 세션 종료</small></span>
              </button>
            </div>
          </nav>
        </div>
      )}

      <div className={s.main}>
        <section className={s.statusLedger} aria-label="운영 환경 상태">
          <div className={s.ledgerItem} data-tone={productionConsole ? "live" : "local"}>
            <Activity size={13} aria-hidden />
            <span>{productionConsole ? "PRODUCTION" : "LOCAL PREVIEW"}</span>
          </div>
          <div className={s.ledgerItem}>
            <ShieldCheck size={13} aria-hidden />
            <span>플랫폼 관리자</span>
          </div>
          <div className={s.ledgerItem}>
            <span className={s.ledgerLabel}>인증 테넌트</span>
            <code>{program?.tenantCode || "확인 중"}</code>
          </div>
          <div className={s.ledgerContext}>
            <span>{currentItem.label}</span>
            <small>{currentItem.description}</small>
          </div>
        </section>
        <Outlet />
      </div>

      <nav className={s.mobileTabBar} aria-label="핵심 개발자 메뉴">
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`${s.mobileTab} ${isActive(item.to) ? s.mobileTabActive : ""}`}
            aria-current={isActive(item.to) ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <item.icon className={s.mobileTabIcon} strokeWidth={1.8} />
            <span className={s.mobileTabLabel}>{item.to === "/dev/inbox" ? "문의함" : item.label.replace("운영 ", "")}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`${s.mobileTab} ${secondaryRouteActive || mobileMenuOpen ? s.mobileTabActive : ""}`}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="전체 메뉴"
          aria-expanded={mobileMenuOpen}
        >
          <MoreHorizontal className={s.mobileTabIcon} />
          <span className={s.mobileTabLabel}>전체</span>
        </button>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
