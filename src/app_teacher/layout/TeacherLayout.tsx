/**
 * PATH: src/app_teacher/layout/TeacherLayout.tsx
 * 선생님 전용 모바일 레이아웃 — 100dvh 고정, 탭바 + 드로어
 */
import { useState, useCallback, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useTeacherSW } from "../shared/hooks/useTeacherSW";
import TeacherTopBar from "./TeacherTopBar";
import TeacherTabBar from "./TeacherTabBar";
import TeacherDrawer from "./TeacherDrawer";
import "../shared/ui/tokens.css";

function TeacherRouteFallback() {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        color: "var(--tc-text-muted)",
        fontSize: 14,
      }}
    >
      불러오는 중...
    </div>
  );
}

export default function TeacherLayout() {
  const tenantCode = getTenantCodeForApiRequest();
  useFavicon();
  useDocumentTitle();
  useTeacherSW();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div
      data-app="teacher"
      data-teacher-tenant={tenantCode || undefined}
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--tc-bg)",
        color: "var(--tc-text)",
        paddingTop: "var(--tc-safe-top)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: "var(--tc-z-header)" as any,
          background: "var(--tc-header-bg)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--tc-border)",
        }}
      >
        <TeacherTopBar tenantCode={tenantCode} />
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: `calc(var(--tc-tabbar-h) + var(--tc-safe-bottom) + var(--tc-space-4))`,
        }}
      >
        <div
          style={{
            maxWidth: "var(--tc-page-max-w)",
            margin: "0 auto",
            padding: "var(--tc-space-3)",
          }}
        >
          <Suspense fallback={<TeacherRouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <TeacherTabBar onMoreClick={openDrawer} />

      {/* Drawer (More menu) */}
      <TeacherDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
