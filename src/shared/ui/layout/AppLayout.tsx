// PATH: src/shared/ui/layout/AppLayout.tsx
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ConfigProvider, App } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AppLayoutMobile from "./AppLayoutMobile";
import { AdminLayoutProvider } from "./AdminLayoutContext";
import { TeacherViewProvider } from "./TeacherViewContext";
import { WorkboxProvider } from "./WorkboxContext";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { FeedbackBridge } from "@/shared/ui/feedback";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProgramProvider } from "@/shared/program";
import { NoticeProvider } from "@/features/notice/context/NoticeContext";
import { SendMessageModalProvider } from "@/features/messages/context/SendMessageModalContext";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useFavicon } from "@/shared/hooks/useFavicon";

// useVersionChecker가 자동 리로드 처리 — 수동 새로고침 배너 제거됨

function AppLayoutContent() {
  const isMobile = useIsMobile();
  useFavicon();

  return (
    <>
      {isMobile ? (
        <AdminLayoutProvider>
          <WorkboxProvider>
            {/* 수동 새로고침 배너 제거 — useVersionChecker가 자동 리로드 처리 */}
            <AppLayoutMobile />
          </WorkboxProvider>
        </AdminLayoutProvider>
      ) : (
    <WorkboxProvider>
    <div
      data-app="admin"
      style={{
        height: "100vh",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--layout-canvas-bg)",
        color: "var(--color-text-primary)",
      }}
    >
      {/* 수동 새로고침 배너 제거 — useVersionChecker가 자동 리로드 처리 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--sidebar-width) 1fr",
          gridTemplateRows: "auto 1fr",
          flex: 1,
          minHeight: 0,
        }}
      >
        <header
          style={{
            gridColumn: "1 / -1",
            position: "sticky",
            top: 0,
            zIndex: 80,
            height: "var(--panel-header)",
            minHeight: "var(--panel-header)",
            background: "var(--layout-header-bg)",
            isolation: "isolate",
          }}
        >
          <Header />
        </header>

        <aside
          className="sidebar"
          style={{
            gridRow: "2",
            position: "sticky",
            top: "var(--panel-header)",
            height: "calc(100vh - var(--panel-header) - var(--notice-banner-height, 0px))",
            overflow: "hidden",
          }}
        >
          <Sidebar />
        </aside>

        <main
          style={{
            gridRow: "2",
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            background: "var(--layout-page-bg)",
          }}
        >
          <div
            style={{
              padding: "var(--space-6)",
              maxWidth: 1520,
              margin: "0 auto",
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <AsyncStatusBar />
    </div>
    </WorkboxProvider>
      )}
    </>
  );
}

export default function AppLayout() {
  return (
    <TeacherViewProvider>
      <ThemeProvider>
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
            <SendMessageModalProvider>
              <AppLayoutContent />
            </SendMessageModalProvider>
            </App>
          </ConfigProvider>
        </NoticeProvider>
      </ProgramProvider>
    </ThemeProvider>
    </TeacherViewProvider>
  );
}
