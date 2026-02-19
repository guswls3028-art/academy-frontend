/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { Outlet } from "react-router-dom";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import "../theme/tokens.css";
import "../theme/tenants/tchul.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";

export default function StudentLayout() {
  const tenantCode = getTenantCodeForApiRequest();

  return (
    <div
      data-student-tenant={tenantCode || undefined}
      style={{
        minHeight: "100dvh",
        background: "var(--stu-bg)",
        color: "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: "var(--stu-z-header)",
          background: "var(--stu-header-bg)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
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
      <AsyncStatusBar />
    </div>
  );
}
