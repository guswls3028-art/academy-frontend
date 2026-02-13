// PATH: src/shared/ui/layout/AppLayout.tsx
import { Outlet } from "react-router-dom";
import { ConfigProvider } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProgramProvider } from "@/shared/program";
import { NoticeProvider } from "@/features/notice/context/NoticeContext";

export default function AppLayout() {
  return (
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
            <div
              data-app="admin"
              style={{
                minHeight: "100vh",
                background: "var(--layout-canvas-bg)",
                color: "var(--color-text-primary)",
              }}
            >
              {/* ===== ROOT GRID ===== */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--sidebar-width) 1fr",
                  gridTemplateRows: "auto 1fr",
                  minHeight: "100vh",
                }}
              >
                {/* ===== 공용 헤더: 사이드바 링크된 모든 admin 페이지에 동일 적용 ===== */}
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

                {/* ===== SIDEBAR ===== */}
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

                {/* ===== MAIN ===== */}
                <main
                  style={{
                    gridRow: "2",
                    minWidth: 0,
                    minHeight: 0,
                    overflow: "auto",
                    overscrollBehavior: "contain",
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
              {/* 우하단 비동기 상태 SSOT (Windows 알림 스타일, 접기/펼치기) */}
              <AsyncStatusBar />
            </div>
          </ConfigProvider>
        </NoticeProvider>
      </ProgramProvider>
    </ThemeProvider>
  );
}
