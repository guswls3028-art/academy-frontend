import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/features/auth/api/auth";
import s from "./DevLayout.module.css";

const NAV_ITEMS = [
  {
    section: "General",
    items: [
      { to: "/dev/dashboard", label: "Dashboard", icon: IconDashboard },
      { to: "/dev/tenants", label: "Tenants", icon: IconTenants },
    ],
  },
];

export default function DevLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className={s.shell}>
      {/* Sidebar */}
      <aside className={s.sidebar}>
        <div className={s.sidebarBrand}>
          <div className={s.brandIcon}>A</div>
          <span className={s.brandName}>Academy</span>
          <span className={s.brandTag}>DEV</span>
        </div>

        <nav className={s.sidebarNav}>
          {NAV_ITEMS.map((section) => (
            <div key={section.section} className={s.navSection}>
              <div className={s.navSectionLabel}>{section.section}</div>
              {section.items.map((item) => (
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
          ))}
        </nav>

        <div className={s.sidebarFooter}>
          <Link to="/admin" className={s.navItem}>
            <IconExternal className={s.navIcon} />
            Admin Console
          </Link>
          <button
            type="button"
            className={s.navItem}
            onClick={() => { logout(); navigate("/login"); }}
          >
            <IconLogout className={s.navIcon} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={s.main}>
        <Outlet />
      </div>
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
