/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { Outlet, useLocation } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import "../theme/tokens.css";
import "../theme/tenants/index.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/** 2번(tchul) 테넌트. 9999는 로컬 개발용으로 2번과 동일한 테마 사용 (별도 카피 없음) */
const TCHUL_THEME_TENANTS = ["tchul", "9999"];

export default function StudentLayout() {
  const location = useLocation();
  const tenantCode = getTenantCodeForApiRequest();
  useFavicon();
  useDocumentTitle(); // 브라우저 타이틀 설정
  const useTchulTheme = tenantCode != null && TCHUL_THEME_TENANTS.includes(String(tenantCode));
  
  // 영상 플레이어 페이지인지 확인
  const isVideoPlayerPage = location.pathname.includes("/student/video/play");

  return (
    <div
      data-app="student"
      data-student-tenant={tenantCode || undefined}
      data-student-theme={useTchulTheme ? "tchul" : undefined}
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--stu-bg)",
        color: "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
        // 배경 그라데이션은 CSS에서 적용 (tchul.css)
      }}
    >
      {useTchulTheme && (
        <svg aria-hidden width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="stu-gradient-tchul" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d47a1" />
              <stop offset="50%" stopColor="#00695c" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: "var(--stu-z-header)",
          background: isVideoPlayerPage ? "rgba(0, 0, 0, 0.9)" : "var(--stu-header-bg)",
          backdropFilter: isVideoPlayerPage ? "blur(16px)" : "blur(12px)",
          borderBottom: isVideoPlayerPage ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid var(--stu-border)",
          /* 프리미엄: 헤더에 미묘한 그림자 */
          boxShadow: isVideoPlayerPage ? "0 2px 8px rgba(0, 0, 0, 0.5)" : "0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <StudentTopBar tenantCode={tenantCode} isDarkMode={isVideoPlayerPage} />
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(var(--stu-tabbar-h) + var(--stu-safe-bottom) + var(--stu-space-4))",
          backgroundColor: isVideoPlayerPage ? "#000" : "transparent",
        }}
      >
        <div style={{ 
          maxWidth: isVideoPlayerPage ? "100%" : "var(--stu-page-max-w)", 
          margin: "0 auto", 
          padding: isVideoPlayerPage ? 0 : "var(--stu-space-4)" 
        }}>
          <Outlet />
        </div>
      </main>

      <StudentTabBar isDarkMode={isVideoPlayerPage} />
    </div>
  );
}
