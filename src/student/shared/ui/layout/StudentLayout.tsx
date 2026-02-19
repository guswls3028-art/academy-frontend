/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { Outlet } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import "../theme/tokens.css";
import "../theme/tenants/index.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import { useFavicon } from "@/shared/hooks/useFavicon";

/** 2번(tchul) 테넌트. 9999는 로컬 개발용으로 2번과 동일한 테마 사용 (별도 카피 없음) */
const TCHUL_THEME_TENANTS = ["tchul", "9999"];

export default function StudentLayout() {
  const tenantCode = getTenantCodeForApiRequest();
  useFavicon();
  const useTchulTheme = tenantCode != null && TCHUL_THEME_TENANTS.includes(String(tenantCode));

  return (
    <div
      data-app="student"
      data-student-tenant={tenantCode || undefined}
      data-student-theme={useTchulTheme ? "tchul" : undefined}
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--stu-bg)",
        color: "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
        // 배경은 흰색 유지 (그라데이션 제거)
      }}
    >
      {useTchulTheme && (
        <svg aria-hidden width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="stu-gradient-tchul" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d47a1" />
              <stop offset="50%" stopColor="#00695c" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: "var(--stu-z-header)",
          background: "var(--stu-header-bg)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
          /* 프리미엄: 헤더에 미묘한 그림자 */
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <StudentTopBar tenantCode={tenantCode} />
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(var(--stu-tabbar-h) + var(--stu-safe-bottom) + var(--stu-space-4))",
        }}
      >
        <div style={{ maxWidth: "var(--stu-page-max-w)", margin: "0 auto", padding: "var(--stu-space-4)" }}>
          <Outlet />
        </div>
      </main>

      <StudentTabBar />
    </div>
  );
}
