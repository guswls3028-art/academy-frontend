/**
 * PATH: src/app_teacher/layout/TeacherLayout.tsx
 * 선생님 전용 레이아웃 — 모바일 탭바, 데스크탑 고정 사이드바
 */
import { useState, useCallback, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useTeacherSW } from "../shared/hooks/useTeacherSW";
import TeacherTopBar from "./TeacherTopBar";
import TeacherTabBar from "./TeacherTabBar";
import TeacherDrawer from "./TeacherDrawer";
import "../shared/ui/tokens.css";
import styles from "./TeacherLayout.module.css";

function TeacherRouteFallback() {
  return (
    <div role="status" aria-label="불러오는 중" className={styles.routeFallback}>
      불러오는 중...
    </div>
  );
}

export default function TeacherLayout() {
  const tenantCode = getTenantCodeForApiRequest();
  const isMobile = useIsMobile();
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
      className={styles.shell}
    >
      {/* Header */}
      <header className={styles.header}>
        <TeacherTopBar onMenuClick={openDrawer} showMenuButton={isMobile} />
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.content}>
          <Suspense fallback={<TeacherRouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <TeacherTabBar />

      {/* Drawer (More menu) */}
      <TeacherDrawer open={drawerOpen} onClose={closeDrawer} persistent={!isMobile} />
    </div>
  );
}
