// PATH: src/student/shared/ui/layout/StudentTabBar.tsx
/**
 * ✅ StudentTabBar (LOCK v2)
 * - Instagram / YouTube 급 모바일 하단 탭바
 * - 미니멀 아이콘 + 명확한 active state
 *
 * 원칙:
 * - 라우팅만 담당 (정책/권한 ❌)
 * - 테마 토큰(--stu-*) 100% 사용
 */

import { NavLink } from "react-router-dom";

type TabItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const tabs: TabItem[] = [
  {
    to: "/student/dashboard",
    label: "홈",
    icon: <IconHome />,
  },
  {
    to: "/student/qna",
    label: "게시판",
    icon: <IconBoard />,
  },
  {
    to: "/student/sessions",
    label: "스케줄",
    icon: <IconCalendar />,
  },
  {
    to: "/student/video",
    label: "영상",
    icon: <IconPlay />,
  },
  {
    to: "/student/profile",
    label: "프로필",
    icon: <IconUser />,
  },
  {
    to: "/student/idcard",
    label: "인증",
    icon: <IconCheck />,
  },
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
        backdropFilter: "blur(18px)",
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
                borderRadius: 16,
                color: isActive
                  ? "var(--stu-primary)"
                  : "var(--stu-text-muted)",
                transition:
                  "transform 120ms ease, color 120ms ease, background 120ms ease",
                background: isActive
                  ? "color-mix(in srgb, var(--stu-primary) 12%, transparent)"
                  : "transparent",
              })}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  display: "grid",
                  placeItems: "center",
                }}
                aria-hidden
              >
                {t.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "-0.2px",
                }}
              >
                {t.label}
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

/* ===============================
   Icons (Inline SVG, MVP)
   =============================== */

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M7 8h10M7 12h10M7 16h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 3v4M16 3v4M3 9h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <polygon
        points="8 5 19 12 8 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
