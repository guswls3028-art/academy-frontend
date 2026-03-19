/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { initParentStudentId } from "@/student/shared/api/parentStudentSelection";
import "../theme/tokens.css";
import "../theme/tenants/index.css";
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

const STU_NOTICE_KEY = "stu_notice_update_20260315";

function StudentUpdateBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STU_NOTICE_KEY) === "1",
  );
  if (dismissed) return null;

  const bar: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "8px 16px",
    background: "var(--stu-primary, #1976d2)", color: "#fff",
    fontSize: 13, fontWeight: 500, lineHeight: 1.5,
    position: "relative", zIndex: 200,
  };
  const btn: CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    padding: "2px 6px", fontSize: 16, color: "rgba(255,255,255,0.8)",
    flexShrink: 0,
  };

  return (
    <div style={bar}>
      <span style={{ flex: 1, textAlign: "center" }}>
        업데이트가 있습니다. 새로고침해주세요.
      </span>
      <button onClick={() => { localStorage.setItem(STU_NOTICE_KEY, "1"); setDismissed(true); }} style={btn} aria-label="닫기">✕</button>
    </div>
  );
}

export default function StudentLayout() {
  const location = useLocation();
  const tenantCode = getTenantCodeForApiRequest();
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
      style={{
        minHeight: "100dvh",
        height: "100dvh", // 높이 고정으로 스크롤 방지
        overflow: "visible",
        backgroundColor: isVideoPage ? "#000" : "var(--stu-bg)",
        color: isVideoPage ? "#fff" : "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
        // 배경 그라데이션은 CSS에서 적용 (tchul.css)
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
      <StudentUpdateBanner />
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: "var(--stu-z-header)",
          background: "var(--stu-header-bg)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
          /* 프리미엄: 헤더에 미묘한 그림자 */
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <StudentTopBar tenantCode={tenantCode} onMenuClick={openDrawer} />
      </header>

      <main
        className={isVideoPage ? "video-page-main" : ""}
        style={{
          flex: 1,
          overflow: "auto",
          scrollbarWidth: "none" as any, // 스크롤바 숨김
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
