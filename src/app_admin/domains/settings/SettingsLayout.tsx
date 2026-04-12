// PATH: src/app_admin/domains/settings/SettingsLayout.tsx
// Premium SaaS 설정 레이아웃 — 사이드바 네비게이션 + 콘텐츠 영역

import { NavLink, Outlet, Link } from "react-router-dom";
import { FiUser, FiHome, FiMonitor, FiCreditCard, FiGlobe } from "react-icons/fi";
import styles from "./SettingsLayout.module.css";
import useAuth from "@/auth/hooks/useAuth";

type NavItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: string[]; // 지정 시 해당 역할만 표시
};

const NAV: NavItem[] = [
  { key: "profile", label: "프로필", icon: FiUser, path: "/admin/settings/profile" },
  { key: "organization", label: "학원 정보", icon: FiHome, path: "/admin/settings/organization" },
  { key: "appearance", label: "테마", icon: FiMonitor, path: "/admin/settings/appearance" },
  { key: "landing", label: "랜딩페이지", icon: FiGlobe, path: "/admin/settings/landing", roles: ["owner", "admin"] },
  { key: "billing", label: "결제 / 구독", icon: FiCreditCard, path: "/admin/settings/billing" },
];

export default function SettingsLayout() {
  const { user } = useAuth();
  const role = user?.tenantRole;

  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <nav className={styles.sidebar} aria-label="설정 메뉴">
        <p className={styles.sidebarLabel}>Settings</p>
        {NAV.filter((item) => !item.roles || (role && item.roles.includes(role))).map(({ key, label, icon: Icon, path }) => (
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
