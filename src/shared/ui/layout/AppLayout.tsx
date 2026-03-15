// PATH: src/shared/ui/layout/AppLayout.tsx
import { useState, useRef, useEffect, useCallback } from "react";
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

// 빌드마다 새 키 → 배포 후 배너 1회 노출, 새로고침 후 사라짐
const BUILD_ID = String(import.meta.env.VITE_APP_VERSION || __BUILD_TIMESTAMP__ || "dev");
const NOTICE_DISMISS_KEY = `admin_refresh_${BUILD_ID}`;

function useNoticeBannerHeight() {
  const bannerRef = useRef<HTMLDivElement>(null);

  const syncHeight = useCallback(() => {
    const h = bannerRef.current?.offsetHeight ?? 0;
    document.documentElement.style.setProperty("--notice-banner-height", `${h}px`);
  }, []);

  useEffect(() => {
    // Sync immediately + watch for resize
    syncHeight();
    const el = bannerRef.current;
    if (el) {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => { ro.disconnect(); document.documentElement.style.setProperty("--notice-banner-height", "0px"); };
    }
    return () => { document.documentElement.style.setProperty("--notice-banner-height", "0px"); };
  }, [syncHeight]);

  return { bannerRef, syncHeight };
}

function NoticeBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(NOTICE_DISMISS_KEY) === "1",
  );
  const { bannerRef, syncHeight } = useNoticeBannerHeight();

  useEffect(() => {
    if (dismissed) {
      document.documentElement.style.setProperty("--notice-banner-height", "0px");
    } else {
      syncHeight();
    }
  }, [dismissed, syncHeight]);

  if (dismissed) return null;

  return (
    <div
      ref={bannerRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 16px",
        background: "color-mix(in srgb, var(--color-success) 10%, var(--color-bg-surface))",
        borderBottom: "1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border-divider))",
        color: "var(--color-text-primary)",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.5,
        position: "relative",
        zIndex: 100,
      }}
    >
      <span style={{ flex: 1, textAlign: "center" }}>
        🔄 시스템이 업데이트되었습니다. 원활한 이용을 위해 <button onClick={() => { localStorage.setItem(NOTICE_DISMISS_KEY, "1"); window.location.reload(); }} style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontWeight: 700, color: "inherit", padding: 0, fontSize: "inherit" }}>새로고침</button>해 주세요.
      </span>
      <button
        onClick={() => {
          localStorage.setItem(NOTICE_DISMISS_KEY, "1");
          setDismissed(true);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 6px",
          fontSize: 16,
          lineHeight: 1,
          color: "var(--color-text-secondary)",
          borderRadius: 4,
          flexShrink: 0,
        }}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

function AppLayoutContent() {
  const isMobile = useIsMobile();
  useFavicon();

  return (
    <>
      {isMobile ? (
        <AdminLayoutProvider>
          <WorkboxProvider>
            <NoticeBanner />
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
      <NoticeBanner />
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
