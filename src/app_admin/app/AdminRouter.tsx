// PATH: src/app_admin/app/AdminRouter.tsx
// 선생앱(관리자) 라우터 — 라우트별 lazy 로딩으로 첫 진입·탭 전환 시 청크 분리

import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { default as AppLayout } from "@admin/layout/AppLayout";
import { DomainLayout } from "@/shared/ui/layout";
import { SendMessageModalProvider } from "@admin/domains/messages/context/SendMessageModalContext";

function AdminRouteFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        color: "var(--color-text-secondary)",
        fontSize: 14,
      }}
    >
      불러오는 중…
    </div>
  );
}

/* ================= Lazy: Dashboard ================= */
const DashboardPage = lazy(() => import("@admin/domains/dashboard/pages/DashboardPage"));

/* ================= Lazy: Students ================= */
const StudentsLayout = lazy(() => import("@admin/domains/students/StudentsLayout"));
const StudentsHomePage = lazy(() => import("@admin/domains/students/pages/StudentsHomePage"));
// StudentsRequestsPage: 동적 import 시 청크 fetch 실패(404) 방지를 위해 정적 import (#310 동일 대응)
import StudentsRequestsPage from "@admin/domains/students/pages/StudentsRequestsPage";
const StudentsDetailOverlay = lazy(() => import("@admin/domains/students/overlays/StudentsDetailOverlay"));

/* ================= Lazy: Lectures ================= */
const LecturesLayout = lazy(() => import("@admin/domains/lectures/LecturesLayout"));
const LecturesPage = lazy(() => import("@admin/domains/lectures/pages/lectures/LecturesPage"));
const LectureLayout = lazy(() => import("@admin/domains/lectures/LectureLayout"));
const LectureStudentsPage = lazy(() => import("@admin/domains/lectures/pages/lectures/LectureStudentsPage"));
const LectureSessionsPage = lazy(() => import("@admin/domains/lectures/pages/sessions/LectureSessionsPage"));
const SectionManagementPage = lazy(() => import("@admin/domains/lectures/pages/sections/SectionManagementPage"));

/* ================= Lazy: Sessions ================= */
// SessionLayout, SessionDetailPage: 동적 import 시 청크 fetch 실패(#310) 방지를 위해 정적 import
import SessionLayout from "@admin/domains/sessions/SessionLayout";
import SessionDetailPage from "@admin/domains/sessions/pages/SessionDetailPage";

/* ================= Lazy: Video ================= */
const VideoDetailPage = lazy(() => import("@admin/domains/videos/pages/VideoDetailPage"));

/* ================= Lazy: Community ================= */
const CommunityPage = lazy(() => import("@admin/domains/community/pages/CommunityPage"));
const QnaInboxPage = lazy(() => import("@admin/domains/community/pages/QnaInboxPage"));
const MaterialsBoardPage = lazy(() => import("@admin/domains/community/pages/MaterialsBoardPage"));
const BoardAdminPage = lazy(() => import("@admin/domains/community/pages/BoardAdminPage"));
const NoticeAdminPage = lazy(() => import("@admin/domains/community/pages/NoticeAdminPage"));
const CounselAdminPage = lazy(() => import("@admin/domains/community/pages/CounselAdminPage"));
const CommunitySettingsPage = lazy(() => import("@admin/domains/community/pages/CommunitySettingsPage"));

/* ================= Lazy: Fees (수납 관리) ================= */
const FeesPage = lazy(() => import("@admin/domains/fees/pages/FeesPage"));
const FeesDashboardTab = lazy(() => import("@admin/domains/fees/components/FeesDashboardTab"));
const FeesInvoicesTab = lazy(() => import("@admin/domains/fees/components/FeesInvoicesTab"));
const FeesTemplatesTab = lazy(() => import("@admin/domains/fees/components/FeesTemplatesTab"));

/* ================= Lazy: Clinic ================= */
const ClinicRoutes = lazy(() => import("@admin/domains/clinic/ClinicRoutes"));

/* ================= Lazy: Profile ================= */
const ProfileLayout = lazy(() => import("@admin/domains/profile").then((m) => ({ default: m.ProfileLayout })));
const ProfileAttendancePage = lazy(() => import("@admin/domains/profile").then((m) => ({ default: m.ProfileAttendancePage })));
const ProfileExpensePage = lazy(() => import("@admin/domains/profile").then((m) => ({ default: m.ProfileExpensePage })));

/* ================= Lazy: Staff ================= */
const StaffRoutes = lazy(() => import("@admin/domains/staff/StaffRoutes"));

/* ================= Lazy: Materials ================= */
const MaterialsRoutes = lazy(() => import("@admin/domains/materials").then((m) => ({ default: m.MaterialsRoutes })));

/* ================= Lazy: Storage ================= */
const StorageRoutes = lazy(() => import("@admin/domains/storage/StorageRoutes"));

/* ================= Lazy: Messages ================= */
const MessageRoutes = lazy(() => import("@admin/domains/messages/MessagesRoutes").then((m) => ({ default: m.MessageRoutes })));

/* ================= Lazy: Tools (도구) ================= */
const ToolsRoutes = lazy(() => import("@admin/domains/tools/ToolsRoutes"));

/* ================= Lazy: Guide ================= */
const AdminGuidePage = lazy(() => import("@admin/domains/guide/pages/AdminGuidePage"));

/* ================= Lazy: Developer ================= */
const DeveloperLayout = lazy(() => import("@admin/domains/developer/DeveloperLayout"));
const PatchNotesPage = lazy(() => import("@admin/domains/developer/pages/DeveloperPage"));
const BugReportPage = lazy(() => import("@admin/domains/developer/pages/DeveloperPage").then(m => ({ default: m.BugReportPage })));
const FeedbackPage = lazy(() => import("@admin/domains/developer/pages/DeveloperPage").then(m => ({ default: m.FeedbackPage })));
const FeatureFlagsPage = lazy(() => import("@admin/domains/developer/pages/FeatureFlagsPage"));

/* ================= Lazy: Settings ================= */
const SettingsLayout = lazy(() => import("@admin/domains/settings/SettingsLayout"));
const ProfileSettingsPage = lazy(() => import("@admin/domains/settings/pages/ProfileSettingsPage"));
const OrganizationSettingsPage = lazy(() => import("@admin/domains/settings/pages/OrganizationSettingsPage"));
// MessagingSettingsPage removed — 발신번호 설정이 메시지 > 설정 탭으로 이동됨
const AppearancePage = lazy(() => import("@admin/domains/settings/pages/AppearancePage"));
const BillingSettingsPage = lazy(() => import("@admin/domains/settings/pages/BillingSettingsPage"));
const CardRegisterCallbackPage = lazy(() => import("@admin/domains/settings/pages/CardRegisterCallbackPage"));
const LandingEditorPage = lazy(() => import("@/landing/editor/LandingEditorPage"));

/* ================= Lazy: Learning (시험·성적·영상) ================= */
const ExamDomainLayout = lazy(() => import("@admin/domains/exams/pages/ExamDomainLayout"));
const ExamExplorerPage = lazy(() => import("@admin/domains/exams/pages/ExamExplorerPage"));
const ExamTemplatesPage = lazy(() => import("@admin/domains/exams/pages/ExamTemplatesPage"));
const ExamBundlesPage = lazy(() => import("@admin/domains/exams/pages/ExamBundlesPage"));
const ResultsExplorerPage = lazy(() => import("@admin/domains/results/pages/ResultsExplorerPage"));
const SubmissionsInboxPage = lazy(() => import("@admin/domains/submissions/pages/SubmissionsInboxPage"));
const VideoExplorerPage = lazy(() => import("@admin/domains/videos/pages/VideoExplorerPage"));
import VideoIdToSessionRedirect from "@admin/domains/videos/pages/VideoIdToSessionRedirect";

/* ================= Lazy: Placeholder ================= */
const CounselPage = lazy(() => import("@admin/domains/counseling/pages/CounselPage"));

function QnaReadRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/admin/community/qna?id=${id}` : "/admin/community/qna"} replace />;
}

const NoticePage = () => (
  <DomainLayout title="공지" description="전체 공지 관리">
    <div className="p-6">공지 페이지</div>
  </DomainLayout>
);

function wrapLazy(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <Suspense fallback={<AdminRouteFallback />}>
      <Component />
    </Suspense>
  );
}

export default function AdminRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={wrapLazy(DashboardPage)} />

        {/* ================= Students (SSOT) ================= */}
        <Route path="students" element={wrapLazy(StudentsLayout)}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={wrapLazy(StudentsHomePage)} />
          <Route path="requests" element={<Suspense fallback={<AdminRouteFallback />}><StudentsRequestsPage /></Suspense>} />
          <Route path="deleted" element={wrapLazy(StudentsHomePage)} />
        </Route>

        {/* 학생 상세 (Overlay / Layout 밖) */}
        <Route path="students/:studentId" element={wrapLazy(StudentsDetailOverlay)} />

        {/* ================= Lectures (SSOT 동일 구조) ================= */}
        <Route path="lectures" element={wrapLazy(LecturesLayout)}>
          <Route index element={wrapLazy(LecturesPage)} />
          <Route path="past" element={<Suspense fallback={<AdminRouteFallback />}>{(() => { const LP = LecturesPage as React.ComponentType<{ tab?: string }>; return <LP tab="past" />; })()}</Suspense>} />
        </Route>

        {/* 강의 상세 — 수강생 + 차시 */}
        <Route path="lectures/:lectureId" element={wrapLazy(LectureLayout)}>
          <Route index element={wrapLazy(LectureStudentsPage)} />
          <Route path="sessions" element={wrapLazy(LectureSessionsPage)} />
        </Route>

        {/* 반 편성 — 자체 헤더로 분리 (section_mode) */}
        <Route path="lectures/:lectureId/sections" element={wrapLazy(SectionManagementPage)} />

        {/* ================= Sessions ================= */}
        <Route
          path="lectures/:lectureId/sessions/:sessionId/*"
          element={
            <SendMessageModalProvider>
              <SessionLayout />
            </SendMessageModalProvider>
          }
        >
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="attendance" element={<SessionDetailPage />} />
          <Route path="scores" element={<SessionDetailPage />} />
          <Route path="exams" element={<SessionDetailPage />} />
          <Route path="assignments" element={<SessionDetailPage />} />
          <Route path="videos" element={<SessionDetailPage />} />
          <Route path="clinic" element={<SessionDetailPage />} />
          <Route path="videos/:videoId" element={wrapLazy(VideoDetailPage)} />
        </Route>

        {/* ================= Materials ================= */}
        <Route path="materials/*" element={wrapLazy(MaterialsRoutes)} />

        {/* ================= Storage (저장소 통합) ================= */}
        <Route path="storage/*" element={wrapLazy(StorageRoutes)} />

        {/* ================= Fees (수납 관리) — feature flag gate in FeesPage ================= */}
        <Route path="fees" element={wrapLazy(FeesPage)}>
          <Route index element={wrapLazy(FeesDashboardTab)} />
          <Route path="invoices" element={wrapLazy(FeesInvoicesTab)} />
          <Route path="templates" element={wrapLazy(FeesTemplatesTab)} />
        </Route>

        {/* ================= Clinic ================= */}
        <Route path="clinic/*" element={wrapLazy(ClinicRoutes)} />

        {/* ================= Learning (시험·성적·영상) ================= */}
        <Route path="exams" element={wrapLazy(ExamDomainLayout)}>
          <Route index element={wrapLazy(ExamExplorerPage)} />
          <Route path="templates" element={wrapLazy(ExamTemplatesPage)} />
          <Route path="bundles" element={wrapLazy(ExamBundlesPage)} />
        </Route>
        <Route path="results/submissions" element={wrapLazy(SubmissionsInboxPage)} />
        <Route path="results" element={wrapLazy(ResultsExplorerPage)} />
        <Route path="videos" element={wrapLazy(VideoExplorerPage)} />
        <Route path="videos/:videoId" element={<VideoIdToSessionRedirect />} />

        <Route path="counsel" element={wrapLazy(CounselPage)} />
        <Route path="notice" element={<NoticePage />} />
        <Route path="message/*" element={wrapLazy(MessageRoutes)} />

        {/* ================= Community ================= */}
        <Route path="community" element={wrapLazy(CommunityPage)}>
          <Route index element={<Navigate to="board" replace />} />
          <Route path="board" element={wrapLazy(BoardAdminPage)} />
          <Route path="notice" element={wrapLazy(NoticeAdminPage)} />
          <Route path="admin" element={<Navigate to="/admin/community/board" replace />} />
          <Route path="qna" element={wrapLazy(QnaInboxPage)} />
          <Route path="qna/read/:id" element={<QnaReadRedirect />} />
          <Route path="counsel" element={wrapLazy(CounselAdminPage)} />
          <Route path="materials" element={wrapLazy(MaterialsBoardPage)} />
          <Route path="settings" element={wrapLazy(CommunitySettingsPage)} />
        </Route>

        {/* ================= Tools (도구) ================= */}
        <Route path="tools/*" element={wrapLazy(ToolsRoutes)} />

        {/* ================= Guide (사용 가이드) ================= */}
        <Route path="guide" element={wrapLazy(AdminGuidePage)} />

        {/* ================= Developer (To개발자) ================= */}
        <Route path="developer" element={wrapLazy(DeveloperLayout)}>
          <Route index element={wrapLazy(PatchNotesPage)} />
          <Route path="bug" element={wrapLazy(BugReportPage)} />
          <Route path="feedback" element={wrapLazy(FeedbackPage)} />
          <Route path="flags" element={wrapLazy(FeatureFlagsPage)} />
        </Route>

        {/* ================= Staff ================= */}
        <Route path="staff/*" element={wrapLazy(StaffRoutes)} />

        {/* ================= 결제 카드 등록 콜백 (Toss 리다이렉트) ================= */}
        <Route path="billing/card/callback" element={wrapLazy(CardRegisterCallbackPage)} />

        {/* ================= 설정 — 사이드바 레이아웃 ================= */}
        <Route path="settings" element={wrapLazy(SettingsLayout)}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={wrapLazy(ProfileSettingsPage)} />
          <Route path="organization" element={wrapLazy(OrganizationSettingsPage)} />
          <Route path="messaging" element={<Navigate to="/admin/message/settings" replace />} />
          <Route path="appearance" element={wrapLazy(AppearancePage)} />
          <Route path="landing" element={wrapLazy(LandingEditorPage)} />
          <Route path="billing" element={wrapLazy(BillingSettingsPage)} />
          <Route path="security" element={<Navigate to="/admin/settings/profile" replace />} />
          {/* 하위 호환 리디렉트 */}
          <Route path="account" element={<Navigate to="/admin/settings/profile" replace />} />
          <Route path="system" element={<Navigate to="/admin/settings/appearance" replace />} />
        </Route>

        {/* ================= Profile (근태 · 지출 — 내 계정은 설정 탭으로) ================= */}
        <Route path="profile" element={wrapLazy(ProfileLayout)}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="account" element={<Navigate to="/admin/settings/profile" replace />} />
          <Route path="attendance" element={wrapLazy(ProfileAttendancePage)} />
          <Route path="expense" element={wrapLazy(ProfileExpensePage)} />
        </Route>

        {/* 매칭되지 않는 admin 하위 경로 → 대시보드로 리디렉트 */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
