// PATH: src/shared/ui/layout/AppLayout.tsx
import { Outlet } from "react-router-dom";
import { ConfigProvider } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AppLayoutMobile from "./AppLayoutMobile";
import { AdminLayoutProvider } from "./AdminLayoutContext";
import { TeacherViewProvider } from "./TeacherViewContext";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProgramProvider } from "@/shared/program";
import { NoticeProvider } from "@/features/notice/context/NoticeContext";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

function AppLayoutContent() {
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? (
        <AdminLayoutProvider>
          <AppLayoutMobile />
        </AdminLayoutProvider>
      ) : (
    <div
      data-app="admin"
      style={{
        height: "100vh",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--layout-canvas-bg)",
        color: "var(--color-text-primary)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--sidebar-width) 1fr",
          gridTemplateRows: "auto 1fr",
          height: "100%",
          minHeight: 0,
        }}
      >
        <header
          style={{
            gridColumn: "1 / -1",
            position: "sticky",
            top: 0,
            zIndex: 80,
            background:
              "color-mix(in srgb, var(--layout-header-bg) 92%, transparent)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
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
            height: "calc(100vh - var(--panel-header))",
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
              algorithm: false,
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
            <AppLayoutContent />
          </ConfigProvider>
        </NoticeProvider>
      </ProgramProvider>
    </ThemeProvider>
  );
}
