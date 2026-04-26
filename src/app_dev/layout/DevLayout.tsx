import { useState } from "react";
import { Outlet, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/auth/api/auth.api";
import { useProgram } from "@/shared/program";
import { CommandPalette, useCommandPaletteHotkey } from "@dev/shared/components/CommandPalette";
import s from "./DevLayout.module.css";

const NAV_ITEMS = [
  { to: "/dev/dashboard", label: "대시보드", icon: IconDashboard },
  { to: "/dev/tenants", label: "테넌트", icon: IconTenants },
  { to: "/dev/billing", label: "결제", icon: IconBilling },
  { to: "/dev/inbox", label: "문의함", icon: IconInbox },
  { to: "/dev/automation", label: "자동화", icon: IconAutomation },
  { to: "/dev/agents", label: "에이전트", icon: IconAgents },
];

export default function DevLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { program } = useProgram();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(setPaletteOpen);

  // 백엔드 OWNER_TENANT_ID(SSOT). isPlatformAdmin 미지원 백엔드는 tenantCode로 폴백.
  if (program) {
    const allowed = program.isPlatformAdmin !== undefined
      ? program.isPlatformAdmin
      : program.tenantCode === "hakwonplus" || program.tenantCode === "9999";
    if (!allowed) {
      return <Navigate to="/admin" replace />;
    }
  }
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className={s.shell}>
      {/* ── Desktop Sidebar ── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarBrand}>
          <div className={s.brandIcon}>A</div>
          <span className={s.brandName}>Academy</span>
          <span className={s.brandTag}>DEV</span>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          style={{
            margin: "12px 12px 4px", padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.06)", color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          }}
          title="글로벌 검색 (Cmd/Ctrl+K)"
        >
          <span>🔍</span>
          <span style={{ flex: 1, textAlign: "left" }}>테넌트·사용자 검색</span>
          <kbd style={{ fontSize: 10, padding: "1px 5px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4 }}>⌘K</kbd>
        </button>

        <nav className={s.sidebarNav}>
          <div className={s.navSection}>
            <div className={s.navSectionLabel}>메뉴</div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`${s.navItem} ${isActive(item.to) ? s.navItemActive : ""}`}
              >
                <item.icon className={s.navIcon} />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className={s.sidebarFooter}>
          <Link to="/admin" className={s.navItem}>
            <IconExternal className={s.navIcon} />
            운영 콘솔
          </Link>
          <button
            type="button"
            className={s.navItem}
            onClick={() => { logout(); navigate("/login"); }}
          >
            <IconLogout className={s.navIcon} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header className={s.mobileTopBar}>
        <div className={s.mobileTopLeft}>
          <div className={s.brandIcon} style={{ width: 24, height: 24, fontSize: 11 }}>A</div>
          <span className={s.mobileBrandName}>Academy <span className={s.brandTag}>DEV</span></span>
        </div>
        <button
          type="button"
          className={s.mobileMenuBtn}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="메뉴"
        >
          {mobileMenuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {/* ── Mobile Dropdown Menu ── */}
      {mobileMenuOpen && (
        <div className={s.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
          <nav className={s.mobileMenu} onClick={(e) => e.stopPropagation()}>
            <Link to="/admin" className={s.mobileMenuItem} onClick={() => setMobileMenuOpen(false)}>
              <IconExternal className={s.navIcon} />
              운영 콘솔
            </Link>
            <button
              type="button"
              className={s.mobileMenuItem}
              onClick={() => { logout(); navigate("/login"); }}
            >
              <IconLogout className={s.navIcon} />
              로그아웃
            </button>
          </nav>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className={s.main}>
        <Outlet />
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className={s.mobileTabBar}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`${s.mobileTab} ${isActive(item.to) ? s.mobileTabActive : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <item.icon className={s.mobileTabIcon} />
            <span className={s.mobileTabLabel}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

/* ===== Inline SVG Icons ===== */

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="10" y="1" width="7" height="4" rx="1.5" />
      <rect x="1" y="10" width="7" height="4" rx="1.5" />
      <rect x="10" y="7" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconTenants({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16V5l6-3.5L15 5v11" />
      <path d="M1 16h16" />
      <rect x="6" y="8" width="6" height="4" rx="0.5" />
      <path d="M9 12v4" />
    </svg>
  );
}

function IconExternal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 10v4.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 012 14.5v-8A1.5 1.5 0 013.5 5H8" />
      <path d="M11 2h5v5" />
      <path d="M7 11L16 2" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16H3.5A1.5 1.5 0 012 14.5v-11A1.5 1.5 0 013.5 2H6" />
      <path d="M12 13l4-4-4-4" />
      <path d="M16 9H7" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function IconBilling({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M2 8h14" />
      <path d="M5 12h3" />
      <path d="M11 12h2" />
    </svg>
  );
}

function IconInbox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10l3-7h8l3 7" />
      <path d="M2 10v4.5A1.5 1.5 0 003.5 16h11a1.5 1.5 0 001.5-1.5V10h-4l-1 2H7l-1-2H2z" />
    </svg>
  );
}

function IconAgents({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="13" cy="5" r="2" />
      <path d="M1 15v-1.5A3.5 3.5 0 014.5 10h3A3.5 3.5 0 0111 13.5V15" />
      <path d="M11 11.5a2.5 2.5 0 015 0V13" />
    </svg>
  );
}

function IconAutomation({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 4.5v4.5l3 2" />
    </svg>
  );
}
