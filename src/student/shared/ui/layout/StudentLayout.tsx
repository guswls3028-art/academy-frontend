/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { initParentStudentId } from "@/student/shared/api/parentStudentSelection";
import { StudentThemeProvider, useStudentTheme } from "@/student/shared/context/StudentThemeContext";
import "../theme/tokens.css";
import "../theme/tenants/index.css";
import "../theme/dark.css";
import "../theme/video.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import StudentDrawer from "./StudentDrawer";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/** 2번(박철과학) 전용 테마 */
const TCHUL_THEME_TENANTS = ["tchul"];
/** 4번(ymath) 전용 테마 — 화이트+스카이블루 */
const YMATH_THEME_TENANTS = ["ymath"];
/** 8번(SSWE) 전용 테마 — 네이비+오렌지 */
const SSWE_THEME_TENANTS = ["sswe"];
/** 9번(DnB) 전용 테마 — 보라+노랑 */
const DNB_THEME_TENANTS = ["dnb"];
/** 1,3,9999번 공통 — commonlogo + 2번 색상 (common=9999 로컬 경로) */
const COMMON_THEME_TENANTS = ["hakwonplus", "limglish", "9999", "common"];

// useVersionChecker가 자동 리로드 처리 — 수동 새로고침 배너 제거됨

export default function StudentLayout() {
  return (
    <StudentThemeProvider>
      <StudentLayoutInner />
    </StudentThemeProvider>
  );
}

function StudentLayoutInner() {
  const location = useLocation();
  const tenantCode = getTenantCodeForApiRequest();
  const { isDark } = useStudentTheme();
  useFavicon();
  useDocumentTitle(); // 브라우저 타이틀 설정
  const useTchulTheme = tenantCode != null && TCHUL_THEME_TENANTS.includes(String(tenantCode));
  const useYmathTheme = tenantCode != null && YMATH_THEME_TENANTS.includes(String(tenantCode));
  const useSsweTheme = tenantCode != null && SSWE_THEME_TENANTS.includes(String(tenantCode));
  const useDnbTheme = tenantCode != null && DNB_THEME_TENANTS.includes(String(tenantCode));
  const useCommonTheme = tenantCode != null && COMMON_THEME_TENANTS.includes(String(tenantCode));

  // 모바일 체감 속도: 첫 화면 로드 후 자주 가는 탭 청크 미리 로드 (영상·일정·시험)
  useEffect(() => {
    const t = window.setTimeout(() => {
      import("@/student/domains/video/pages/VideoHomePage").catch(() => {});
      import("@/student/domains/sessions/pages/SessionListPage").catch(() => {});
      import("@/student/domains/exams/pages/ExamListPage").catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // 학부모 로그인 시 선택 자녀 ID 초기화 (linkedStudents 기준)
  const { user } = useAuthContext();
  useEffect(() => {
    if (user?.tenantRole === "parent" && user?.linkedStudents?.length) {
      initParentStudentId(user.linkedStudents.map((s) => s.id));
    }
  }, [user?.tenantRole, user?.linkedStudents]);

  // 사이드 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // 영상 페이지 전체인지 확인 (영상 홈, 코스 상세, 세션 상세, 플레이어 모두 포함)
  const isVideoPage = location.pathname.startsWith("/student/video");

  return (
    <div
      data-app="student"
      data-student-tenant={tenantCode || undefined}
      data-student-theme={useTchulTheme ? "tchul" : useYmathTheme ? "ymath" : useSsweTheme ? "sswe" : useDnbTheme ? "dnb" : useCommonTheme ? "common" : undefined}
      data-video-page={isVideoPage ? "true" : undefined}
      data-student-dark={isDark ? "true" : undefined}
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        overflow: "visible",
        backgroundColor: "var(--stu-bg)",
        color: "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
      }}
    >
      {(useTchulTheme || useYmathTheme || useSsweTheme || useDnbTheme || useCommonTheme) && (
        <svg aria-hidden width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="stu-gradient-tchul" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d47a1" />
              <stop offset="50%" stopColor="#00695c" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
            <linearGradient id="stu-gradient-ymath" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B4A82" />
              <stop offset="50%" stopColor="#4DAAD6" />
              <stop offset="100%" stopColor="#8ED0EE" />
            </linearGradient>
            <linearGradient id="stu-gradient-common" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d47a1" />
              <stop offset="50%" stopColor="#00695c" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
            <linearGradient id="stu-gradient-sswe" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#002357" />
              <stop offset="40%" stopColor="#003580" />
              <stop offset="100%" stopColor="#f18e2c" />
            </linearGradient>
            <linearGradient id="stu-gradient-dnb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#612e8d" />
              <stop offset="50%" stopColor="#7b3faa" />
              <stop offset="100%" stopColor="#c9a82e" />
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
          background: "var(--stu-header-bg)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <StudentTopBar tenantCode={tenantCode} onMenuClick={openDrawer} />
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          scrollbarWidth: "none" as any,
          paddingBottom: "calc(var(--stu-tabbar-h) + var(--stu-safe-bottom) + var(--stu-space-4))",
        }}
      >
        <div style={{
          maxWidth: isVideoPage ? "100%" : "var(--stu-page-max-w)",
          margin: "0 auto",
          padding: isVideoPage ? 0 : "var(--stu-space-4)",
          overflow: "visible",
          height: "auto",
        }}>
          <Outlet />
        </div>
      </main>

      <StudentTabBar />
      <StudentDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
