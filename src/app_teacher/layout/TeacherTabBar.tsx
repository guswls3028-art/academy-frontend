/**
 * PATH: src/app_teacher/layout/TeacherTabBar.tsx
 * 하단 탭 — 오늘 | 수업 | 학생 | 소통 | 더보기
 */
import { NavLink } from "react-router-dom";

interface Props {
  onMoreClick: () => void;
}

interface TabItem {
  to: string;
  label: string;
  icon: () => React.ReactElement;
  end?: boolean;
  isDrawer?: boolean;
}

const tabs: TabItem[] = [
  { to: "/teacher", label: "오늘", icon: CalendarIcon, end: true },
  { to: "/teacher/classes", label: "수업", icon: BookIcon },
  { to: "/teacher/students", label: "학생", icon: UsersIcon },
  { to: "/teacher/comms", label: "소통", icon: MessageIcon },
  { to: "", label: "더보기", icon: MenuIcon, isDrawer: true },
];

export default function TeacherTabBar({ onMoreClick }: Props) {
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
        {tabs.map((t) => {
          if (t.isDrawer) {
            const Icon = t.icon;
            return (
              <button
                key="more"
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
                  <Icon />
                </span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          }

          const Icon = t.icon;
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
              <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon />
              </span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/* ===== Inline SVG Icons ===== */

function CalendarIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={2} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={3} y1={10} x2={21} y2={10} />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={3} y1={12} x2={21} y2={12} />
      <line x1={3} y1={6} x2={21} y2={6} />
      <line x1={3} y1={18} x2={21} y2={18} />
    </svg>
  );
}
