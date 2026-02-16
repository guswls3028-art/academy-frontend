/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 상단바 + 스크롤 영역 + 하단 탭바
 */
import { Outlet } from "react-router-dom";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import "../theme/tokens.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";

export default function StudentLayout() {
  return (
    <div
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
          background: "rgba(11, 15, 25, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
        }}
      >
        <StudentTopBar />
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
