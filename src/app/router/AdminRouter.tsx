// PATH: src/app/router/AdminRouter.tsx
// 선생앱(관리자) 라우터 — 라우트별 lazy 로딩으로 첫 진입·탭 전환 시 청크 분리

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { AppLayout, DomainLayout } from "@/shared/ui/layout";
import { SendMessageModalProvider } from "@/features/messages/context/SendMessageModalContext";

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
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));

/* ================= Lazy: Students ================= */
const StudentsLayout = lazy(() => import("@/features/students/StudentsLayout"));
const StudentsHomePage = lazy(() => import("@/features/students/pages/StudentsHomePage"));
const StudentsRequestsPage = lazy(() => import("@/features/students/pages/StudentsRequestsPage"));
const StudentsDetailOverlay = lazy(() => import("@/features/students/overlays/StudentsDetailOverlay"));

/* ================= Lazy: Lectures ================= */
const LecturesLayout = lazy(() => import("@/features/lectures/layout/LecturesLayout"));
const LecturesPage = lazy(() => import("@/features/lectures/pages/lectures/LecturesPage"));
const LectureLayout = lazy(() => import("@/features/lectures/layout/LectureLayout"));
const LectureStudentsPage = lazy(() => import("@/features/lectures/pages/lectures/LectureStudentsPage"));
const LectureReportPage = lazy(() => import("@/features/lectures/pages/lectures/LectureReportPage"));
const LectureSessionsPage = lazy(() => import("@/features/lectures/pages/sessions/LectureSessionsPage"));
const LectureDdayPage = lazy(() => import("@/features/lectures/pages/ddays/LectureDdayPage"));
const LectureAttendanceMatrixPage = lazy(() => import("@/features/lectures/pages/attendance/LectureAttendanceMatrixPage"));

/* ================= Lazy: Sessions ================= */
const SessionLayout = lazy(() => import("@/features/sessions/layout/SessionLayout"));
const SessionDetailPage = lazy(() => import("@/features/sessions/pages/SessionDetailPage"));

/* ================= Lazy: Video ================= */
const VideoDetailPage = lazy(() => import("@/features/videos/pages/VideoDetailPage"));

/* ================= Lazy: Community ================= */
const CommunityPage = lazy(() => import("@/features/community/pages/CommunityPage"));
const QnaInboxPage = lazy(() => import("@/features/community/pages/QnaInboxPage"));
const MaterialsBoardPage = lazy(() => import("@/features/community/pages/MaterialsBoardPage"));
const CommunityAdminPage = lazy(() => import("@/features/community/pages/CommunityAdminPage"));
const BoardAdminPage = lazy(() => import("@/features/community/pages/BoardAdminPage"));
const NoticeAdminPage = lazy(() => import("@/features/community/pages/NoticeAdminPage"));
const CommunitySettingsPage = lazy(() => import("@/features/community/pages/CommunitySettingsPage"));

/* ================= Lazy: Clinic ================= */
const ClinicRoutes = lazy(() => import("@/features/clinic/ClinicRoutes"));

/* ================= Lazy: Profile ================= */
const ProfileLayout = lazy(() => import("@/features/profile").then((m) => ({ default: m.ProfileLayout })));
const ProfileAccountPage = lazy(() => import("@/features/profile").then((m) => ({ default: m.ProfileAccountPage })));
const ProfileAttendancePage = lazy(() => import("@/features/profile").then((m) => ({ default: m.ProfileAttendancePage })));
const ProfileExpensePage = lazy(() => import("@/features/profile").then((m) => ({ default: m.ProfileExpensePage })));

/* ================= Lazy: Staff ================= */
const StaffRoutes = lazy(() => import("@/features/staff/StaffRoutes"));

/* ================= Lazy: Materials ================= */
const MaterialsRoutes = lazy(() => import("@/features/materials").then((m) => ({ default: m.MaterialsRoutes })));

/* ================= Lazy: Storage ================= */
const StorageRoutes = lazy(() => import("@/features/storage/StorageRoutes"));

/* ================= Lazy: Messages ================= */
const MessageRoutes = lazy(() => import("@/features/messages/routes").then((m) => ({ default: m.MessageRoutes })));

/* ================= Lazy: Settings ================= */
const SettingsLayout = lazy(() => import("@/features/settings/SettingsLayout"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));

/* ================= Lazy: Exams / Results / Videos ================= */
const ExamExplorerPage = lazy(() => import("@/features/exams/pages/ExamExplorerPage"));
const ResultsExplorerPage = lazy(() => import("@/features/results/pages/ResultsExplorerPage"));
const VideoExplorerPage = lazy(() => import("@/features/videos/pages/VideoExplorerPage"));

/* ================= Lazy: Placeholder ================= */
const CounselPage = lazy(() => import("@/features/counseling/pages/CounselPage"));

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
        <Route
          path="students"
          element={
            <SendMessageModalProvider>
              {wrapLazy(StudentsLayout)}
            </SendMessageModalProvider>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={wrapLazy(StudentsHomePage)} />
          <Route path="requests" element={wrapLazy(StudentsRequestsPage)} />
          <Route path="deleted" element={wrapLazy(StudentsHomePage)} />
        </Route>

        {/* 학생 상세 (Overlay / Layout 밖) */}
        <Route path="students/:studentId" element={wrapLazy(StudentsDetailOverlay)} />

        {/* ================= Lectures (SSOT 동일 구조) ================= */}
        <Route path="lectures" element={wrapLazy(LecturesLayout)}>
          <Route index element={wrapLazy(LecturesPage)} />
          <Route path="past" element={<Suspense fallback={<AdminRouteFallback />}><LecturesPage tab="past" /></Suspense>} />
        </Route>

        {/* 강의 상세 — 수강생만 표시 (탭 제거) */}
        <Route path="lectures/:lectureId" element={wrapLazy(LectureLayout)}>
          <Route index element={wrapLazy(LectureStudentsPage)} />
          <Route path="sessions" element={wrapLazy(LectureSessionsPage)} />
        </Route>

        {/* ================= Sessions ================= */}
        <Route
          path="lectures/:lectureId/sessions/:sessionId/*"
          element={wrapLazy(SessionLayout)}
        >
          <Route index element={wrapLazy(SessionDetailPage)} />
          <Route path="overview" element={wrapLazy(SessionDetailPage)} />
          <Route path="attendance" element={wrapLazy(SessionDetailPage)} />
          <Route path="scores" element={wrapLazy(SessionDetailPage)} />
          <Route path="exams" element={wrapLazy(SessionDetailPage)} />
          <Route path="assignments" element={wrapLazy(SessionDetailPage)} />
          <Route path="videos" element={wrapLazy(SessionDetailPage)} />
          <Route path="videos/:videoId" element={wrapLazy(VideoDetailPage)} />
        </Route>

        {/* ================= Materials ================= */}
        <Route path="materials/*" element={wrapLazy(MaterialsRoutes)} />

        {/* ================= Storage (저장소 통합) ================= */}
        <Route path="storage/*" element={wrapLazy(StorageRoutes)} />

        {/* ================= Clinic ================= */}
        <Route path="clinic/*" element={wrapLazy(ClinicRoutes)} />

        {/* ================= Exams ================= */}
        <Route path="exams" element={wrapLazy(ExamExplorerPage)} />

        {/* ================= Results ================= */}
        <Route path="results" element={wrapLazy(ResultsExplorerPage)} />

        {/* ================= Videos (Admin Root) ================= */}
        <Route path="videos" element={wrapLazy(VideoExplorerPage)} />

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
          <Route path="materials" element={wrapLazy(MaterialsBoardPage)} />
          <Route path="settings" element={wrapLazy(CommunitySettingsPage)} />
        </Route>

        {/* ================= Staff ================= */}
        <Route path="staff/*" element={wrapLazy(StaffRoutes)} />

        {/* ================= 설정 (내 정보 · 테마 탭) ================= */}
        <Route path="settings" element={wrapLazy(SettingsLayout)}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account" element={wrapLazy(ProfileAccountPage)} />
          <Route path="system" element={wrapLazy(SettingsPage)} />
        </Route>

        {/* ================= Profile (근태 · 지출 — 내 계정은 설정 탭으로) ================= */}
        <Route path="profile" element={wrapLazy(ProfileLayout)}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="account" element={<Navigate to="/admin/settings/account" replace />} />
          <Route path="attendance" element={wrapLazy(ProfileAttendancePage)} />
          <Route path="expense" element={wrapLazy(ProfileExpensePage)} />
        </Route>
      </Route>
    </Routes>
  );
}
