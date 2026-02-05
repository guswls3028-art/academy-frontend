// PATH: src/student/shared/ui/layout/StudentLayout.tsx
/**
 * ✅ StudentLayout (LOCK v3)
 *
 * 책임:
 * - 학생앱 전역 레이아웃 "디자인" SSOT
 * - 상단바 + (Dashboard 한정 공지/일정) + 페이지 컨텐츠 + 하단탭바
 *
 * 원칙:
 * - 도메인 로직/데이터 판단 ❌
 * - UI 구조만 제공 ✅
 */

import { Outlet, useLocation } from "react-router-dom";
import "../theme/tokens.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import StudentHomeStrip from "./StudentHomeStrip";

export default function StudentLayout() {
  const location = useLocation();
  const isDashboard =
    location.pathname === "/student" ||
    location.pathname.startsWith("/student/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--stu-bg)",
        color: "var(--stu-text)",
      }}
    >
      {/* ===== Header ===== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--stu-z-header)" as any,
          background: "color-mix(in srgb, var(--stu-surface) 88%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
        }}
      >
        <div className="stu-page" style={{ padding: "0 var(--stu-space-8)" }}>
          <StudentTopBar />
        </div>
      </div>

      {/* ===== Main ===== */}
      <main
        style={{
          display: "flex",
          justifyContent: "center",
          paddingBottom: `calc(var(--stu-tabbar-h) + var(--stu-space-12) + var(--stu-safe-bottom))`,
        }}
      >
        <div
          className="stu-page"
          style={{ padding: "var(--stu-space-10) var(--stu-space-8)" }}
        >
          {/* ✅ Dashboard에서만 공지/일정 노출 */}
          {isDashboard && <StudentHomeStrip />}

          {/* Page content */}
          <div
            style={{
              marginTop: isDashboard ? "var(--stu-space-10)" : 0,
            }}
          >
            <Outlet />
          </div>
        </div>
      </main>

      {/* ===== Bottom TabBar ===== */}
      <StudentTabBar />
    </div>
  );
}
