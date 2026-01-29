// src/student/app/StudentLayout.tsx
/**
 * ✅ StudentLayout (LOCK v1)
 * - "상용 SaaS" 기준 최소 Shell
 * - 하단 탭 제거 (요구사항)
 * - 상단에 간단한 네비(생산성)만 제공
 *
 * 주의:
 * - 정책 판단/계산 ❌
 * - 단순 라우팅 링크 제공만 ✅
 *
 * UI는 나중에 CSS 분리 예정이라 최대한 간소화함.
 */

import { NavLink, Outlet } from "react-router-dom";

export default function StudentLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ===== Header ===== */}
      <header
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid #eee",
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 800 }}>STUDENT</div>

        {/* ✅ 최소 네비 (상용 SaaS 생산성용) */}
        <nav style={{ display: "flex", gap: 12, fontSize: 14 }}>
          <TopLink to="/student/dashboard" label="홈" />
          <TopLink to="/student/sessions" label="차시" />
          <TopLink to="/student/exams" label="시험" />
          <TopLink to="/student/grades" label="성적" />
          <TopLink to="/student/qna" label="Q&A" />
        </nav>
      </header>

      {/* ===== Content ===== */}
      <main style={{ flex: 1, padding: 16, background: "#fafafa" }}>
        <Outlet />
      </main>
    </div>
  );
}

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        textDecoration: "none",
        color: isActive ? "#111" : "#666",
        fontWeight: isActive ? 700 : 500,
      })}
    >
      {label}
    </NavLink>
  );
}
