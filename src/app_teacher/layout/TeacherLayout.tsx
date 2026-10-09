/**
 * PATH: src/app_teacher/layout/TeacherLayout.tsx
 * 선생님 전용 레이아웃 — 모바일 탭바, 데스크탑 고정 사이드바
 */
import { useState, useCallback, useMemo, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { App as AntdApp } from "antd";
import { FeedbackBridge } from "@/shared/ui/feedback";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useTeacherSW } from "../shared/hooks/useTeacherSW";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import TeacherTopBar from "./TeacherTopBar";
import TeacherTabBar from "./TeacherTabBar";
import TeacherDrawer from "./TeacherDrawer";
import { useTeacherNavigation } from "./useTeacherNavigation";
import useAuth from "@/auth/hooks/useAuth";
import QuickNavigationDialog, {
  type QuickNavigationItem,
} from "@/shared/ui/navigation/QuickNavigationDialog";
import { useQuickNavigationHotkey } from "@/shared/ui/navigation/useQuickNavigationHotkey";
import { useWorkspaceFeatures, WORKSPACE_FEATURE_CATEGORY_LABELS } from "@/shared/ui/navigation/useWorkspaceFeatures";
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
  const location = useLocation();
  const navigate = useNavigate();
  const tenantCode = getTenantCodeForApiRequest();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { groups: navigationGroups } = useTeacherNavigation();
  useFavicon();
  useDocumentTitle();
  useTeacherSW();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const featureDiscovery = useWorkspaceFeatures();
  const [quickNavigationOpen, setQuickNavigationOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openQuickNavigation = useCallback(() => setQuickNavigationOpen(true), []);
  useQuickNavigationHotkey(openQuickNavigation);

  const quickNavigationItems = useMemo<QuickNavigationItem[]>(
    () => [...navigationGroups.flatMap((group) => group.items.flatMap((item) => (
      item.path
        ? [{
            to: item.path,
            label: item.label,
            group: group.title,
            icon: item.icon,
            keywords: item.keywords,
          }]
        : []
    ))), ...featureDiscovery.features.map((feature) => ({
      to: feature.path,
      label: feature.title,
      group: WORKSPACE_FEATURE_CATEGORY_LABELS[feature.category],
      description: feature.desc,
      keywords: feature.keywords,
      icon: feature.icon,
    }))],
    [navigationGroups, featureDiscovery.features],
  );
  const quickNavigationStorageKey = tenantCode && user
    ? `ui.quick-navigation.v1:teacher:${tenantCode}:${user.id}`
    : null;

  return (
    <AntdApp component={false}>
      <FeedbackBridge />
    <div
      data-app="teacher"
      data-teacher-tenant={tenantCode || undefined}
      className={styles.shell}
    >
      {/* Header */}
      <header className={styles.header}>
        <TeacherTopBar
          onMenuClick={openDrawer}
          onQuickNavigationClick={openQuickNavigation}
          showMenuButton={isMobile}
        />
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
      <TeacherDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        persistent={!isMobile}
        menuGroups={navigationGroups}
      />

      <QuickNavigationDialog
        open={quickNavigationOpen}
        onClose={() => setQuickNavigationOpen(false)}
        items={quickNavigationItems}
        storageKey={quickNavigationStorageKey}
        onNavigate={(destination) => {
          if (destination.startsWith("/workspace/") && !destination.startsWith("/workspace/mobile")) {
            setPreferFullWorkspace(true, { accountId: user?.id, mobileReturnPath: `${location.pathname}${location.search}` });
          }
          navigate(destination);
        }}
        placement="teacher.quick-navigation"
        permissionStatus={featureDiscovery.permissionStatus}
        onRetryPermissions={() => void featureDiscovery.retryPermissions()}
      />

      {/* 엑셀 등록 등 백그라운드 작업 진행·결과 */}
      <div className={styles.asyncStatus}>
        <AsyncStatusBar hideWhenEmpty />
      </div>
    </div>
    </AntdApp>
  );
}
