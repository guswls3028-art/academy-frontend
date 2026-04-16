/**
 * PATH: src/app_teacher/layout/TeacherTabBar.tsx
 * 하단 탭 — 사이드바(메뉴) | 오늘 | 수업 | 학생 | 소통
 * PC 사이드바를 좌측 드로어로 열기 (첫 번째 탭)
 */
import { NavLink } from "react-router-dom";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import {
  Menu, Home, BookOpen, Users, MessageSquare,
} from "@teacher/shared/ui/Icons";

interface Props {
  onMoreClick: () => void;
}

interface TabItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  isDrawer?: boolean;
}

export default function TeacherTabBar({ onMoreClick }: Props) {
  const { counts } = useAdminNotificationCounts();
  const badge = counts?.total ?? 0;

  const tabs: TabItem[] = [
    { to: "", label: "메뉴", icon: <Menu size={22} />, isDrawer: true },
    { to: "/teacher", label: "오늘", icon: <Home size={22} />, end: true },
    { to: "/teacher/classes", label: "수업", icon: <BookOpen size={22} /> },
    { to: "/teacher/students", label: "학생", icon: <Users size={22} /> },
    { to: "/teacher/comms", label: "소통", icon: <MessageSquare size={22} /> },
  ];

  return (
    <nav
      aria-label="하단 메뉴"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: "var(--tc-z-tabbar)" as any,
        paddingBottom: "var(--tc-safe-bottom)",
        background: "var(--tc-tabbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--tc-border)",
      }}
    >
      <div
        style={{
          height: "var(--tc-tabbar-h)",
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          alignItems: "center",
          maxWidth: "var(--tc-page-max-w)",
          margin: "0 auto",
          padding: "0 var(--tc-space-2)",
        }}
      >
        {tabs.map((t, i) => {
          if (t.isDrawer) {
            return (
              <button
                key="menu"
                onClick={onMoreClick}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  height: "100%",
                  color: "var(--tc-text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {t.icon}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              style={({ isActive }) => ({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                height: "100%",
                color: isActive ? "var(--tc-primary)" : "var(--tc-text-muted)",
                textDecoration: "none",
                transition: "color var(--tc-motion-fast)",
                borderRadius: "var(--tc-radius-sm)",
              })}
            >
              <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {t.icon}
                {t.to === "/teacher/comms" && badge > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -8,
                      minWidth: 14,
                      height: 14,
                      lineHeight: "14px",
                      fontSize: 9,
                      fontWeight: 700,
                      textAlign: "center",
                      borderRadius: 7,
                      padding: "0 3px",
                      background: "#ef4444",
                      color: "#fff",
                    }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
