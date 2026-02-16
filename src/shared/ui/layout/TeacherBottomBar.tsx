/**
 * 선생앱 모바일 전용: 하단 탭바. 홈/학생/강의/커뮤니티/메뉴(드로어)
 */
import { NavLink, useNavigate } from "react-router-dom";
import { useAdminLayout } from "./AdminLayoutContext";
import { ADMIN_MOBILE_TABS, NavIcon } from "./adminNavConfig";

export default function TeacherBottomBar() {
  const layout = useAdminLayout();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="하단 메뉴"
      className="teacher-tabbar"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
        paddingBottom: "env(safe-area-inset-bottom, 0)",
        background: "color-mix(in srgb, var(--layout-header-bg) 96%, transparent)",
        backdropFilter: "blur(14px)",
        borderTop: "1px solid var(--color-border-divider)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          height: 56,
          display: "grid",
          gridTemplateColumns: `repeat(${ADMIN_MOBILE_TABS.length}, 1fr)`,
          alignItems: "center",
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 8px",
        }}
      >
        {ADMIN_MOBILE_TABS.map((t) => {
          if (t.to === "") {
            return (
              <button
                key="menu"
                type="button"
                onClick={() => layout?.openDrawer()}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  height: "100%",
                  color: "var(--color-text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <NavIcon d={t.iconPath} />
                </span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={t.to}
              to={t.to}
              style={({ isActive }) => ({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                height: "100%",
                color: isActive ? "var(--color-brand-primary)" : "var(--color-text-muted)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              })}
            >
              <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <NavIcon d={t.iconPath} />
              </span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
