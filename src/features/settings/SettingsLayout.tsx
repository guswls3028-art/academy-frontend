// PATH: src/features/settings/SettingsLayout.tsx
// Premium SaaS 설정 레이아웃 — 사이드바 네비게이션 + 콘텐츠 영역

import { NavLink, Outlet, Link } from "react-router-dom";
import { FiUser, FiHome, FiMonitor, FiCreditCard } from "react-icons/fi";
import styles from "./SettingsLayout.module.css";

type NavItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
};

const NAV: NavItem[] = [
  { key: "profile", label: "프로필", icon: FiUser, path: "/admin/settings/profile" },
  { key: "organization", label: "학원 정보", icon: FiHome, path: "/admin/settings/organization" },
  { key: "appearance", label: "테마", icon: FiMonitor, path: "/admin/settings/appearance" },
  { key: "billing", label: "결제 / 구독", icon: FiCreditCard, path: "/admin/settings/billing" },
];

export default function SettingsLayout() {
  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <nav className={styles.sidebar} aria-label="설정 메뉴">
        <p className={styles.sidebarLabel}>Settings</p>
        {NAV.map(({ key, label, icon: Icon, path }) => (
          <NavLink
            key={key}
            to={path}
            className={({ isActive }) =>
              `${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ""}`
            }
          >
            <Icon size={15} className={styles.navIcon} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className={styles.sidebarLegal}>
          <Link to="/terms" target="_blank" className={styles.legalLink}>이용약관</Link>
          <span className={styles.legalSep}>·</span>
          <Link to="/privacy" target="_blank" className={styles.legalLink}>개인정보처리방침</Link>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
