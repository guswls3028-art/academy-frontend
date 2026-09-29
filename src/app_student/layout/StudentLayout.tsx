/**
 * 학생 앱 전역 레이아웃 — 전체화면 고정, 모바일 특화
 * 테넌트별 테마: STUDENT_THEME_BY_TENANT → data-student-theme → theme/tenants/{theme}.css
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useAuthContext } from "@/auth/context/AuthContext";
import {
  getParentStudentId,
  initParentStudentId,
  isStudentScopedQueryKey,
  resetParentStudentIdInMemory,
  setParentStudentId,
} from "@/shared/api/parentStudentSelection";
import { StudentThemeProvider } from "@student/shared/context/StudentThemeContext";
import { useStudentTheme } from "@student/shared/context/studentTheme";
import "../shared/ui/theme/tokens.css";
import "../shared/ui/theme/tenants/index.css";
import "../shared/ui/theme/dark.css";
import "../shared/ui/theme/video.css";
import "./StudentLayout.css";

import StudentTopBar from "./StudentTopBar";
import StudentTabBar from "./StudentTabBar";
import StudentDrawer from "./StudentDrawer";
import ParentChildSwitcher from "./ParentChildSwitcher";
import { useFavicon } from "@/shared/hooks/useFavicon";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { GuideTourProvider, GuideTourOverlay } from "@/shared/ui/guide";
import { useStudentPwa } from "@student/shared/hooks/useStudentPwa";
import {
  closeStudentSupportWindow,
  endStudentSupportSession,
  getStudentSupportSessionInfo,
  isStudentSupportWindow,
} from "@/shared/auth/supportPreviewSession";
import { endCurrentStudentSupportPreview } from "@/shared/studentSupport/studentSupport.api";
import { logout } from "@/auth/api/auth.api";

/**
 * 테넌트 코드 → 학생앱 테마(theme/tenants/{theme}.css). 9999·common 로컬 경로는 common 테마를 쓴다.
 * 등록되지 않은 테넌트는 tokens.css 기본 테마를 그대로 사용한다.
 */
const STUDENT_THEME_BY_TENANT: Readonly<Record<string, string>> = {
  hakwonplus: "hakwonplus",
  tchul: "tchul",
  limglish: "limglish",
  ymath: "ymath",
  sswe: "sswe",
  dnb: "dnb",
  movementhui: "movementhui",
  godmin: "godmin",
  "9999": "common",
  common: "common",
};

/** CommonLogoIcon이 gradientId로 참조하는 로고 전용 그라데이션 (아이콘 그라데이션과 분리) */
const LOGO_GRADIENTS = [
  { id: "stu-gradient-hakwonplus", stops: ["#1e3a8a", "#2563eb", "#60a5fa"] },
  { id: "stu-gradient-ymath", stops: ["#0B4A82", "#4DAAD6", "#8ED0EE"] },
  { id: "stu-gradient-common", stops: ["#0d47a1", "#00695c", "#004d40"] },
] as const;

// 새 배포 안내는 AppInner의 전역 VersionUpdateNotice가 맡는다.

export default function StudentLayout() {
  return (
    <StudentThemeProvider>
      <GuideTourProvider>
        <StudentLayoutInner />
        <GuideTourOverlay />
      </GuideTourProvider>
    </StudentThemeProvider>
  );
}

function StudentLayoutInner() {
  const location = useLocation();
  const tenantCode = getTenantCodeForApiRequest();
  const { isDark } = useStudentTheme();
  useFavicon();
  useDocumentTitle(); // 브라우저 타이틀 설정
  useStudentPwa();
  const themeKey = tenantCode != null ? String(tenantCode) : "";
  const studentTheme = Object.prototype.hasOwnProperty.call(STUDENT_THEME_BY_TENANT, themeKey)
    ? STUDENT_THEME_BY_TENANT[themeKey]
    : undefined;
  const { user } = useAuthContext();
  const supportInfo = isStudentSupportWindow() ? getStudentSupportSessionInfo() : null;
  const [supportRemainingSeconds, setSupportRemainingSeconds] = useState<number | null>(null);
  const [supportClosing, setSupportClosing] = useState(false);
  const queryClient = useQueryClient();

  const [parentSelectionReady, setParentSelectionReady] = useState(false);
  const [selectedParentStudentId, setSelectedParentStudentId] = useState<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-student-app", "true");
    return () => root.removeAttribute("data-student-app");
  }, []);

  const clearStudentScopedQueries = useCallback(() => {
    const studentScopePredicate = (query: { queryKey: readonly unknown[] }) =>
      isStudentScopedQueryKey(query.queryKey);
    void queryClient.resetQueries({ predicate: studentScopePredicate });
    queryClient.removeQueries({ predicate: studentScopePredicate });
    void queryClient.invalidateQueries({ predicate: studentScopePredicate });
  }, [queryClient]);

  useEffect(() => {
    if (!user) {
      resetParentStudentIdInMemory();
      setSelectedParentStudentId(null);
      setParentSelectionReady(false);
      return;
    }
    if (user.tenantRole !== "parent") {
      const previousId = getParentStudentId();
      resetParentStudentIdInMemory();
      if (previousId != null) clearStudentScopedQueries();
      setSelectedParentStudentId(null);
      setParentSelectionReady(true);
      return;
    }
    const ids = user.linkedStudents?.map((s) => s.id) ?? [];
    if (!ids.length) {
      const previousId = getParentStudentId();
      setParentStudentId(null, user.id);
      if (previousId != null) clearStudentScopedQueries();
      setSelectedParentStudentId(null);
      setParentSelectionReady(true);
      return;
    }
    const previousId = getParentStudentId();
    const nextId = initParentStudentId(ids, user.id);
    if (previousId !== nextId) clearStudentScopedQueries();
    setSelectedParentStudentId(nextId);
    setParentSelectionReady(true);
  }, [clearStudentScopedQueries, user]);

  useEffect(() => {
    if (!supportInfo?.expiresAt) {
      setSupportRemainingSeconds(null);
      return undefined;
    }
    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(supportInfo.expiresAt).getTime() - Date.now()) / 1_000),
      );
      setSupportRemainingSeconds(remaining);
      if (remaining === 0) {
        endStudentSupportSession();
        window.location.replace("/support-preview-ended?reason=expired");
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(timer);
  }, [supportInfo?.expiresAt]);

  const handleSupportEnd = useCallback(async () => {
    if (supportClosing) return;
    setSupportClosing(true);
    try {
      await endCurrentStudentSupportPreview();
    } catch {
      // Closing locally is still safe because the server token expires within 15 minutes.
    } finally {
      closeStudentSupportWindow();
    }
  }, [supportClosing]);

  // 모바일 체감 속도: 첫 화면 로드 후 자주 가는 탭 청크 미리 로드 (영상·일정·시험)
  useEffect(() => {
    const t = window.setTimeout(() => {
      import("@student/domains/video/pages/VideoHomePage").catch(() => {});
      import("@student/domains/sessions/pages/SessionListPage").catch(() => {});
      import("@student/domains/exams/pages/ExamListPage").catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // 사이드 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // 영상 페이지 전체인지 확인 (영상 홈, 코스 상세, 세션 상세, 플레이어 모두 포함)
  const isVideoPage = location.pathname.startsWith("/student/video");
  const isParent = user?.tenantRole === "parent";
  const linkedStudents = user?.linkedStudents ?? [];
  const linkedStudentCount = linkedStudents.length;
  const hasValidParentSelection = !isParent || linkedStudents.some((student) => student.id === selectedParentStudentId);
  const studentContextReady = user != null && parentSelectionReady && hasValidParentSelection;
  const parentNeedsSelection = parentSelectionReady && isParent && linkedStudentCount > 1 && !hasValidParentSelection;
  const parentHasNoStudent = parentSelectionReady && isParent && linkedStudentCount === 0;

  return (
    <div
      className="student-layout"
      data-app="student"
      data-student-tenant={tenantCode || undefined}
      data-student-theme={studentTheme}
      data-video-page={isVideoPage ? "true" : undefined}
      data-student-dark={isDark ? "true" : undefined}
    >
      {studentTheme && (
        <svg aria-hidden width={0} height={0} className="student-layout__defs">
          <defs>
            {/* 콘텐츠 아이콘용 — 정지점 색은 테넌트 토큰(--stu-icon-1/2)이 라이트·다크별로 정한다 */}
            <linearGradient id="stu-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="stu-icon-gradient__stop--start" />
              <stop offset="100%" className="stu-icon-gradient__stop--end" />
            </linearGradient>
            {LOGO_GRADIENTS.map(({ id, stops }) => (
              <linearGradient key={id} id={id} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={stops[0]} />
                <stop offset="50%" stopColor={stops[1]} />
                <stop offset="100%" stopColor={stops[2]} />
              </linearGradient>
            ))}
          </defs>
        </svg>
      )}
      <header className="student-layout__header">
        {supportInfo && (
          <div className="student-layout__support-banner" role="region" aria-label="교직원 학생 화면 대리보기">
            <div>
              <strong>교직원 대리보기</strong>
              <span>
                {supportInfo.studentName} 화면 · 로그인 기록과 분리
                {supportRemainingSeconds != null
                  ? ` · ${String(Math.floor(supportRemainingSeconds / 60)).padStart(2, "0")}:${String(supportRemainingSeconds % 60).padStart(2, "0")} 남음`
                  : ""}
              </span>
            </div>
            <button type="button" disabled={supportClosing} onClick={() => void handleSupportEnd()}>
              {supportClosing ? "종료 중…" : "보기 종료"}
            </button>
          </div>
        )}
        {studentContextReady && (
          <>
            <StudentTopBar tenantCode={tenantCode} onMenuClick={openDrawer} />
            {isParent && linkedStudentCount > 1 && (
              <ParentChildSwitcher
                selectedStudentId={selectedParentStudentId}
                onSelectionChange={setSelectedParentStudentId}
              />
            )}
          </>
        )}
      </header>

      <main className="student-layout__main">
        <div className="student-layout__content">
          {studentContextReady && <Outlet />}
          {(parentNeedsSelection || parentHasNoStudent) && (
            <section className="student-layout__parent-gate" aria-labelledby="parent-student-gate-title">
              <div className="student-layout__parent-gate-icon" aria-hidden>
                <UsersRound size={22} strokeWidth={2.25} />
              </div>
              <h1 id="parent-student-gate-title">
                {parentNeedsSelection ? "확인할 자녀를 선택해 주세요" : "연결된 자녀가 없습니다"}
              </h1>
              <p>
                {parentNeedsSelection
                  ? "성적, 수강 일정, 과제와 영상은 선택한 자녀의 정보만 표시됩니다."
                  : "학원에 자녀 계정 연결을 요청해 주세요. 다른 학생 정보는 임의로 표시하지 않습니다."}
              </p>
              {parentNeedsSelection && (
                <ParentChildSwitcher
                  selectedStudentId={selectedParentStudentId}
                  onSelectionChange={setSelectedParentStudentId}
                  variant="gate"
                />
              )}
              <button type="button" onClick={logout}>로그아웃</button>
            </section>
          )}
        </div>
      </main>

      {studentContextReady && <StudentTabBar />}
      {studentContextReady && <StudentDrawer open={drawerOpen} onClose={closeDrawer} />}
    </div>
  );
}
