/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: data-student-tenant 에 따라 theme/tenants/{code}.css 적용
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { initParentStudentId } from "@/student/shared/api/parentStudentSelection";
import "../theme/tokens.css";
import "../theme/tenants/index.css";
import "../theme/video.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/** 2번(박철과학) 전용 테마 */
const TCHUL_THEME_TENANTS = ["tchul"];
/** 1,3,4,9999번 공통 — commonlogo + 2번 색상 (common=9999 로컬 경로) */
const COMMON_THEME_TENANTS = ["hakwonplus", "limglish", "ymath", "sswe", "9999", "common"];

export default function StudentLayout() {
  const location = useLocation();
  const tenantCode = getTenantCodeForApiRequest();
  useFavicon();
  useDocumentTitle(); // 브라우저 타이틀 설정
  const useTchulTheme = tenantCode != null && TCHUL_THEME_TENANTS.includes(String(tenantCode));
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
  
  // 영상 페이지 전체인지 확인 (영상 홈, 코스 상세, 세션 상세, 플레이어 모두 포함)
  const isVideoPage = location.pathname.startsWith("/student/video");

  return (
    <div
      data-app="student"
      data-student-tenant={tenantCode || undefined}
      data-student-theme={useTchulTheme ? "tchul" : useCommonTheme ? "common" : undefined}
      data-video-page={isVideoPage ? "true" : undefined}
      style={{
        minHeight: "100dvh",
        height: "100dvh", // 높이 고정으로 스크롤 방지
        overflow: isVideoPage ? "hidden" : "visible", // 영상 페이지는 스크롤 완전 차단
        backgroundColor: isVideoPage ? "#000" : "var(--stu-bg)",
        color: isVideoPage ? "#fff" : "var(--stu-text)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--stu-safe-top)",
        // 배경 그라데이션은 CSS에서 적용 (tchul.css)
      }}
    >
      {(useTchulTheme || useCommonTheme) && (
        <svg aria-hidden width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="stu-gradient-tchul" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d47a1" />
              <stop offset="50%" stopColor="#00695c" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
            <linearGradient id="stu-gradient-common" x1="0%" y1="0%" x2="100%" y2="100%">
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
          background: "var(--stu-header-bg)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--stu-border)",
          /* 프리미엄: 헤더에 미묘한 그림자 */
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <StudentTopBar tenantCode={tenantCode} />
      </header>

      <main
        className={isVideoPage ? "video-page-main" : ""}
        style={{
          flex: 1,
          overflow: isVideoPage ? "hidden" : "auto", // 영상 페이지는 스크롤 완전 차단, 다른 페이지는 main에서 스크롤
          paddingBottom: "calc(var(--stu-tabbar-h) + var(--stu-safe-bottom) + var(--stu-space-4))",
        }}
      >
        <div style={{ 
          maxWidth: isVideoPage ? "100%" : "var(--stu-page-max-w)", 
          margin: "0 auto", 
          padding: isVideoPage ? 0 : "var(--stu-space-4)",
          overflow: isVideoPage ? "hidden" : "visible", // 영상 페이지는 스크롤 차단
          height: isVideoPage ? "100%" : "auto", // 영상 페이지는 높이 제한
        }}>
          <Outlet />
        </div>
      </main>

      <StudentTabBar />
    </div>
  );
}
