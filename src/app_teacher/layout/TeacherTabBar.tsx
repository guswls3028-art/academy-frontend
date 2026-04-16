/**
 * PATH: src/app_teacher/layout/TeacherTabBar.tsx
 * 하단 탭 — 오늘 | 강의 | 학생 | 커뮤니티 (4탭, 사이드바는 헤더에서 열기)
 * 용어: 데스크톱 사이드바와 통일
 */
import { NavLink } from "react-router-dom";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { Home, BookOpen, Users, MessageSquare } from "@teacher/shared/ui/Icons";

export default function TeacherTabBar() {
  const { counts } = useAdminNotificationCounts();
  const badge = counts?.total ?? 0;

  const tabs = [
    { to: "/teacher", label: "오늘", icon: <Home size={22} />, end: true },
    { to: "/teacher/classes", label: "강의", icon: <BookOpen size={22} /> },
    { to: "/teacher/students", label: "학생", icon: <Users size={22} /> },
    { to: "/teacher/comms", label: "커뮤니티", icon: <MessageSquare size={22} />, hasBadge: true },
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
        {tabs.map((t) => (
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
              transition: "color 100ms ease",
            })}
          >
            <span
              style={{
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {t.icon}
              {t.hasBadge && badge > 0 && (
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
        ))}
      </div>
    </nav>
  );
}
