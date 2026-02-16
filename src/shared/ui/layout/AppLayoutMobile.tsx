/**
 * 선생앱 모바일 전용 레이아웃: 상단 헤더 + 메인 스크롤 + 하단 탭바. 네비는 드로어로.
 */
import { Outlet } from "react-router-dom";
import Header from "./Header";
import AdminNavDrawer from "./AdminNavDrawer";
import TeacherBottomBar from "./TeacherBottomBar";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";

const TABBAR_HEIGHT = 56;
const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0)";

export default function AppLayoutMobile() {
  return (
    <div
      data-app="admin"
      style={{
        height: "100vh",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--layout-canvas-bg)",
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 80,
          background: "color-mix(in srgb, var(--layout-header-bg) 92%, transparent)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <Header />
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: "var(--layout-page-bg)",
          padding: "var(--space-4)",
          paddingBottom: `calc(${TABBAR_HEIGHT}px + ${SAFE_BOTTOM} + var(--space-4))`,
        }}
      >
        <Outlet />
      </main>

      <AdminNavDrawer />
      <TeacherBottomBar />
      <AsyncStatusBar />
    </div>
  );
}
