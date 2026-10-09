// PATH: src/app_admin/layout/AppLayout.tsx
import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { ConfigProvider, App } from "antd";
import { AdminLayoutProvider } from "./AdminLayoutContext";
import { TeacherViewProvider } from "./TeacherViewContext";
import { WorkboxProvider } from "@/shared/ui/layout/WorkboxContext";
import { FeedbackBridge } from "@/shared/ui/feedback";
import { ProgramProvider } from "@/shared/program";
import { NoticeProvider } from "@admin/domains/notice/context/NoticeContext";
import { SendMessageModalProvider } from "@admin/domains/messages/context/SendMessageModalContext";
import { ClinicHighlightProvider } from "@/shared/contexts/ClinicHighlightContext";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { GuideTourProvider, GuideTourOverlay } from "@/shared/ui/guide";
import QuickNavigationDialog, {
  type QuickNavigationItem,
} from "@/shared/ui/navigation/QuickNavigationDialog";
import { useQuickNavigationHotkey } from "@/shared/ui/navigation/useQuickNavigationHotkey";
import { useWorkspaceFeatures, WORKSPACE_FEATURE_CATEGORY_LABELS } from "@/shared/ui/navigation/useWorkspaceFeatures";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";
import { NavIcon } from "./adminNavConfig";
import { useAvailableAdminNavigation } from "./useAvailableAdminNavigation";
import StopwatchSessionProvider from "@admin/domains/tools/stopwatch/StopwatchSessionProvider";
import PptSessionProvider from "@admin/domains/tools/ppt/PptSessionProvider";

// 새 배포 안내는 AppInner의 전역 VersionUpdateNotice가 맡는다.

const ResponsiveAdminLayout = lazy(() => import("./ResponsiveAdminLayout"));

function AppLayoutContent({ overlay }: { overlay?: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const navigationGroups = useAvailableAdminNavigation();
  const featureDiscovery = useWorkspaceFeatures();
  const [quickNavigationOpen, setQuickNavigationOpen] = useState(false);
  const openQuickNavigation = useCallback(() => setQuickNavigationOpen(true), []);
  useQuickNavigationHotkey(openQuickNavigation);
  useFavicon();

  const quickNavigationItems = useMemo<QuickNavigationItem[]>(
    () => [...navigationGroups.flatMap((group) => group.items.map((item) => ({
      to: item.to,
      label: item.label,
      group: group.title ?? "메뉴",
      keywords: item.keywords,
      icon: <NavIcon d={item.iconPath} />,
    }))), ...featureDiscovery.features.map((feature) => ({
      to: feature.path,
      label: feature.title,
      group: WORKSPACE_FEATURE_CATEGORY_LABELS[feature.category],
      description: feature.desc,
      keywords: feature.keywords,
      icon: feature.icon,
    }))],
    [navigationGroups, featureDiscovery.features],
  );
  const tenantCode = getTenantCodeForApiRequest();
  const quickNavigationStorageKey = tenantCode && user
    ? `ui.quick-navigation.v1:admin:${tenantCode}:${user.id}`
    : null;

  return (
    <>
      <StopwatchSessionProvider pathname={location.pathname}>
      <PptSessionProvider pathname={location.pathname} tenant={tenantCode} userId={user?.id == null ? null : String(user.id)}>
      <AdminLayoutProvider>
        <WorkboxProvider>
          <Suspense fallback={null}>
            <ResponsiveAdminLayout onOpenQuickNavigation={openQuickNavigation} />
          </Suspense>
        </WorkboxProvider>
      </AdminLayoutProvider>
      </PptSessionProvider>
      </StopwatchSessionProvider>
      <QuickNavigationDialog
        open={quickNavigationOpen}
        onClose={() => setQuickNavigationOpen(false)}
        items={quickNavigationItems}
        storageKey={quickNavigationStorageKey}
        placement="admin.quick-navigation"
        permissionStatus={featureDiscovery.permissionStatus}
        onRetryPermissions={() => void featureDiscovery.retryPermissions()}
      />
      {overlay}
    </>
  );
}

export default function AppLayout({ overlay }: { overlay?: ReactNode }) {
  return (
    <TeacherViewProvider>
      <ProgramProvider>
        <NoticeProvider>
          <ConfigProvider
            theme={{
              algorithm: undefined,
              token: {
                colorPrimary: "var(--color-brand-primary)",

                colorBgBase: "var(--layout-canvas-bg)",
                colorBgLayout: "var(--layout-page-bg)",
                colorBgContainer: "var(--color-bg-surface)",
                colorBgElevated: "var(--color-bg-surface)",

                colorBorder: "var(--color-border-divider)",

                colorText: "var(--color-text-primary)",
                colorTextSecondary: "var(--color-text-secondary)",
                colorTextTertiary: "var(--color-text-muted)",
                colorTextQuaternary: "var(--color-text-disabled)",
                colorTextPlaceholder: "var(--color-text-muted)",

                colorFillSecondary: "var(--color-bg-surface-hover)",
                colorFillTertiary: "var(--color-bg-surface-hover)",
              },
              components: {
                Segmented: {
                  itemColor: "var(--color-text-secondary)",
                  itemHoverColor: "var(--color-text-primary)",
                  itemSelectedColor: "var(--color-text-inverse)",
                  itemSelectedBg: "var(--color-brand-primary)",
                  trackBg: "var(--color-bg-surface-hover)",
                  borderRadius: 10,
                },
                Button: {
                  colorPrimary: "var(--color-brand-primary)",
                  colorTextLightSolid: "var(--color-text-inverse)",
                  borderRadius: 10,
                },
                Checkbox: {
                  colorPrimary: "var(--color-brand-primary)",
                },
                Table: {
                  headerBg: "var(--color-bg-surface-hover)",
                  headerColor: "var(--color-text-secondary)",
                  headerSplitColor: "var(--color-border-divider)",
                  rowHoverBg: "var(--color-bg-surface-hover)",
                  borderColor: "var(--color-border-divider)",
                },
              },
            }}
          >
            <App>
            <FeedbackBridge />
            <GuideTourProvider>
            <ClinicHighlightProvider>
            <SendMessageModalProvider>
              <AppLayoutContent overlay={overlay} />
              <GuideTourOverlay />
            </SendMessageModalProvider>
            </ClinicHighlightProvider>
            </GuideTourProvider>
            </App>
          </ConfigProvider>
        </NoticeProvider>
      </ProgramProvider>
    </TeacherViewProvider>
  );
}
