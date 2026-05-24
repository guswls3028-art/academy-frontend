// PATH: src/app_admin/app/AdminRouter.tsx
// 선생앱(관리자) 라우터 — 라우트별 lazy 로딩으로 첫 진입·탭 전환 시 청크 분리

import { Suspense, type ComponentType } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { default as AppLayout } from "@admin/layout/AppLayout";
import RouteFallback from "@/core/router/RouteFallback";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

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
const SessionLayout = lazy(() => import("@admin/domains/sessions/SessionLayout"));
const SessionDetailPage = lazy(() => import("@admin/domains/sessions/pages/SessionDetailPage"));

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
const ReportsAdminPage = lazy(() => import("@admin/domains/community/pages/ReportsAdminPage"));
const CommunityStatsPage = lazy(() => import("@admin/domains/community/pages/CommunityStatsPage"));
// 외부 공개 커뮤니티 통합 모더레이션 inbox (Phase 4-C, 2026-05-12).
// family-only community와 별개 도메인 — landing_public 트랙.
const LandingPublicInboxPage = lazy(() => import("@admin/domains/landing-public/pages/LandingPublicInboxPage"));

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
const LandingConsultInboxPage = lazy(() => import("@/landing/admin/LandingConsultInboxPage"));

/* ================= Lazy: Learning (시험·성적·영상) ================= */
const ExamDomainLayout = lazy(() => import("@admin/domains/exams/pages/ExamDomainLayout"));
const ExamExplorerPage = lazy(() => import("@admin/domains/exams/pages/ExamExplorerPage"));
const ExamTemplatesPage = lazy(() => import("@admin/domains/exams/pages/ExamTemplatesPage"));
const ExamBundlesPage = lazy(() => import("@admin/domains/exams/pages/ExamBundlesPage"));
const ResultsDomainLayout = lazy(() => import("@admin/domains/results/pages/ResultsDomainLayout"));
const ResultsExplorerPage = lazy(() => import("@admin/domains/results/pages/ResultsExplorerPage"));
const ResultsTreePage = lazy(() => import("@admin/domains/results/pages/ResultsTreePage"));
const SubmissionsInboxPage = lazy(() => import("@admin/domains/submissions/pages/SubmissionsInboxPage"));
const VideoDomainLayout = lazy(() => import("@admin/domains/videos/pages/VideoDomainLayout"));
const VideoExplorerPage = lazy(() => import("@admin/domains/videos/pages/VideoExplorerPage"));
const VideoTreePage = lazy(() => import("@admin/domains/videos/pages/VideoTreePage"));
const VideoIdToSessionRedirect = lazy(() => import("@admin/domains/videos/pages/VideoIdToSessionRedirect"));

/* ================= Lazy: Placeholder ================= */
const CounselPage = lazy(() => import("@admin/domains/counseling/pages/CounselPage"));

function QnaReadRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/admin/community/qna?id=${id}` : "/admin/community/qna"} replace />;
}

export default function AdminRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={renderLazyRoute(DashboardPage)} />

        {/* ================= Students (SSOT) ================= */}
        <Route path="students" element={renderLazyRoute(StudentsLayout)}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={renderLazyRoute(StudentsHomePage)} />
          <Route path="requests" element={<Suspense fallback={<RouteFallback />}><StudentsRequestsPage /></Suspense>} />
          <Route path="deleted" element={renderLazyRoute(StudentsHomePage)} />
        </Route>

        {/* 학생 상세 (Overlay / Layout 밖) */}
        <Route path="students/:studentId" element={<Suspense fallback={<RouteFallback />}><StudentsDetailOverlay /></Suspense>} />

        {/* ================= Lectures (SSOT 동일 구조) ================= */}
        <Route path="lectures" element={renderLazyRoute(LecturesLayout)}>
          <Route index element={renderLazyRoute(LecturesPage)} />
          <Route path="past" element={<Suspense fallback={<RouteFallback />}>{(() => { const LP = LecturesPage as ComponentType<{ tab?: string }>; return <LP tab="past" />; })()}</Suspense>} />
        </Route>

        {/* 강의 상세 — 수강생 + 차시 */}
        <Route path="lectures/:lectureId" element={renderLazyRoute(LectureLayout)}>
          <Route index element={renderLazyRoute(LectureStudentsPage)} />
          <Route path="sessions" element={renderLazyRoute(LectureSessionsPage)} />
        </Route>

        {/* 반 편성 — 자체 헤더로 분리 (section_mode) */}
        <Route path="lectures/:lectureId/sections" element={renderLazyRoute(SectionManagementPage)} />

        {/* ================= Sessions ================= */}
        <Route
          path="lectures/:lectureId/sessions/:sessionId/*"
          element={renderLazyRoute(SessionLayout)}
        >
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="attendance" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="scores" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="exams" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="assignments" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="videos" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="clinic" element={renderLazyRoute(SessionDetailPage)} />
          <Route path="videos/:videoId" element={renderLazyRoute(VideoDetailPage)} />
        </Route>

        {/* ================= Materials ================= */}
        <Route path="materials/*" element={renderLazyRoute(MaterialsRoutes)} />

        {/* ================= Storage (저장소 통합) ================= */}
        <Route path="storage/*" element={renderLazyRoute(StorageRoutes)} />

        {/* 적중 보고서는 자료저장소 3번째 탭으로 이동 — 외부 북마크 호환 redirect */}
        <Route path="hit-reports" element={<Navigate to="/admin/storage/hit-reports" replace />} />

        {/* ================= Fees (수납 관리) — feature flag gate in FeesPage ================= */}
        <Route path="fees" element={renderLazyRoute(FeesPage)}>
          <Route index element={renderLazyRoute(FeesDashboardTab)} />
          <Route path="invoices" element={renderLazyRoute(FeesInvoicesTab)} />
          <Route path="templates" element={renderLazyRoute(FeesTemplatesTab)} />
        </Route>

        {/* ================= Clinic ================= */}
        <Route path="clinic/*" element={renderLazyRoute(ClinicRoutes)} />

        {/* ================= Learning (시험·성적·영상) ================= */}
        <Route path="exams" element={renderLazyRoute(ExamDomainLayout)}>
          <Route index element={renderLazyRoute(ExamExplorerPage)} />
          <Route path="templates" element={renderLazyRoute(ExamTemplatesPage)} />
          <Route path="bundles" element={renderLazyRoute(ExamBundlesPage)} />
        </Route>
        <Route path="results" element={renderLazyRoute(ResultsDomainLayout)}>
          <Route index element={renderLazyRoute(ResultsExplorerPage)} />
          <Route path="tree" element={renderLazyRoute(ResultsTreePage)} />
          <Route path="submissions" element={renderLazyRoute(SubmissionsInboxPage)} />
        </Route>
        <Route path="videos" element={renderLazyRoute(VideoDomainLayout)}>
          <Route index element={renderLazyRoute(VideoExplorerPage)} />
          <Route path="tree" element={renderLazyRoute(VideoTreePage)} />
        </Route>
        <Route path="videos/:videoId" element={renderLazyRoute(VideoIdToSessionRedirect)} />

        <Route path="counsel" element={renderLazyRoute(CounselPage)} />
        <Route path="notice" element={<Navigate to="/admin/community/notice" replace />} />
        <Route path="message/*" element={renderLazyRoute(MessageRoutes)} />

        {/* ================= Community ================= */}
        <Route path="community" element={renderLazyRoute(CommunityPage)}>
          <Route index element={<Navigate to="board" replace />} />
          <Route path="board" element={renderLazyRoute(BoardAdminPage)} />
          <Route path="notice" element={renderLazyRoute(NoticeAdminPage)} />
          <Route path="admin" element={<Navigate to="/admin/community/board" replace />} />
          <Route path="qna" element={renderLazyRoute(QnaInboxPage)} />
          <Route path="qna/read/:id" element={<QnaReadRedirect />} />
          <Route path="counsel" element={renderLazyRoute(CounselAdminPage)} />
          <Route path="materials" element={renderLazyRoute(MaterialsBoardPage)} />
          <Route path="settings" element={renderLazyRoute(CommunitySettingsPage)} />
          <Route path="reports" element={renderLazyRoute(ReportsAdminPage)} />
          <Route path="stats" element={renderLazyRoute(CommunityStatsPage)} />
        </Route>

        {/* 외부 공개 커뮤니티 (landing_public) 모더레이션 — community 도메인과 별개 트랙 */}
        <Route path="landing-public/inbox" element={renderLazyRoute(LandingPublicInboxPage)} />
        <Route path="landing-public" element={<Navigate to="/admin/landing-public/inbox" replace />} />

        {/* ================= Tools (도구) ================= */}
        <Route path="tools/*" element={renderLazyRoute(ToolsRoutes)} />

        {/* ================= Guide (사용 가이드) ================= */}
        <Route path="guide" element={renderLazyRoute(AdminGuidePage)} />

        {/* ================= Developer (To개발자) ================= */}
        <Route path="developer" element={renderLazyRoute(DeveloperLayout)}>
          <Route index element={renderLazyRoute(PatchNotesPage)} />
          <Route path="bug" element={renderLazyRoute(BugReportPage)} />
          <Route path="feedback" element={renderLazyRoute(FeedbackPage)} />
          <Route path="flags" element={renderLazyRoute(FeatureFlagsPage)} />
        </Route>

        {/* ================= Staff ================= */}
        <Route path="staff/*" element={renderLazyRoute(StaffRoutes)} />

        {/* ================= 결제 카드 등록 콜백 (Toss 리다이렉트) ================= */}
        <Route path="billing/card/callback" element={renderLazyRoute(CardRegisterCallbackPage)} />

        {/* ================= 설정 — 사이드바 레이아웃 ================= */}
        <Route path="settings" element={renderLazyRoute(SettingsLayout)}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={renderLazyRoute(ProfileSettingsPage)} />
          <Route path="organization" element={renderLazyRoute(OrganizationSettingsPage)} />
          <Route path="messaging" element={<Navigate to="/admin/message/settings" replace />} />
          <Route path="appearance" element={renderLazyRoute(AppearancePage)} />
          <Route path="landing" element={renderLazyRoute(LandingEditorPage)} />
          <Route path="consult" element={renderLazyRoute(LandingConsultInboxPage)} />
          <Route path="billing" element={renderLazyRoute(BillingSettingsPage)} />
          <Route path="security" element={<Navigate to="/admin/settings/profile" replace />} />
          {/* 하위 호환 리디렉트 */}
          <Route path="account" element={<Navigate to="/admin/settings/profile" replace />} />
          <Route path="system" element={<Navigate to="/admin/settings/appearance" replace />} />
        </Route>

        {/* ================= Profile (근태 · 지출 — 내 계정은 설정 탭으로) ================= */}
        <Route path="profile" element={renderLazyRoute(ProfileLayout)}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="account" element={<Navigate to="/admin/settings/profile" replace />} />
          <Route path="attendance" element={renderLazyRoute(ProfileAttendancePage)} />
          <Route path="expense" element={renderLazyRoute(ProfileExpensePage)} />
        </Route>

        {/* 매칭되지 않는 admin 하위 경로 → 대시보드로 리디렉트 */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
