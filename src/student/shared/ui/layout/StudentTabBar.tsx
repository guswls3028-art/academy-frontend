// PATH: src/student/shared/ui/layout/StudentTabBar.tsx
/**
 * ✅ StudentTabBar (LOCK v1)
 * - 하단 탭바 (모바일 최적화)
 *
 * 원칙:
 * - 권한/정책 판단 ❌
 * - 라우팅 링크만 ✅
 */

import { NavLink } from "react-router-dom";

type TabItem = {
  to: string;
  label: string;
  icon: string; // emoji (MVP)
};

const tabs: TabItem[] = [
  { to: "/student/dashboard", label: "홈", icon: "🏠" },
  { to: "/student/sessions", label: "차시", icon: "📚" },
  { to: "/student/exams", label: "시험", icon: "📝" },
  { to: "/student/grades", label: "성적", icon: "📈" },
  { to: "/student/qna", label: "Q&A", icon: "💬" },
];

export default function StudentTabBar() {
  return (
    <nav
      aria-label="학생 하단 탭"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: "var(--stu-z-tabbar)" as any,
        paddingBottom: "var(--stu-safe-bottom)",
        background: "color-mix(in srgb, var(--stu-surface) 92%, transparent)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid var(--stu-border)",
        boxShadow: "var(--stu-shadow-3)",
      }}
    >
      <div
        className="stu-page"
        style={{
          padding: "0 var(--stu-space-8)",
        }}
      >
        <div
          style={{
            height: "var(--stu-tabbar-h)",
            display: "grid",
            gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
            gap: 8,
            alignItems: "center",
          }}
        >
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              style={({ isActive }) => ({
                display: "grid",
                placeItems: "center",
                gap: 4,
                height: 52,
                borderRadius: 14,
                border: `1px solid ${isActive ? "color-mix(in srgb, var(--stu-primary) 45%, var(--stu-border))" : "transparent"}`,
                background: isActive ? "color-mix(in srgb, var(--stu-primary) 10%, transparent)" : "transparent",
                color: isActive ? "var(--stu-text)" : "var(--stu-text-muted)",
                fontWeight: 900,
                transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease",
              })}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: "16px" }}>
                {t.icon}
              </span>
              <span style={{ fontSize: 11, lineHeight: "12px" }}>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
