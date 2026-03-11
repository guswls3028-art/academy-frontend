/**
 * PATH: src/student/app/StudentRouter.tsx
 * 학생 앱 라우터 — 모바일 전용, 5탭(홈|영상|일정|알림|더보기)
 */
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { Navigate, Route, Routes } from "react-router-dom";
import StudentLayout from "@/student/shared/ui/layout/StudentLayout";

const DashboardPage = lazy(() => import("@/student/domains/dashboard/pages/DashboardPage"));
const VideoHomePage = lazy(() => import("@/student/domains/video/pages/VideoHomePage"));
const CourseDetailPage = lazy(() => import("@/student/domains/video/pages/CourseDetailPage"));
const VideoSessionDetailPage = lazy(() => import("@/student/domains/video/pages/SessionDetailPage"));
const VideoPlayerPage = lazy(() =>
  import("@/student/domains/video/pages/VideoPlayerPage").then((m) => ({ default: m.default }))
);

const SessionListPage = lazy(() => import("@/student/domains/sessions/pages/SessionListPage"));
const SessionDetailPage = lazy(() => import("@/student/domains/sessions/pages/SessionDetailPage"));

const ExamListPage = lazy(() => import("@/student/domains/exams/pages/ExamListPage"));
const ExamDetailPage = lazy(() => import("@/student/domains/exams/pages/ExamDetailPage"));
const ExamSubmitPage = lazy(() => import("@/student/domains/exams/pages/ExamSubmitPage"));
const ExamResultPage = lazy(() => import("@/student/domains/exams/pages/ExamResultPage"));
const SubmitHubPage = lazy(() => import("@/student/domains/submit/pages/SubmitHubPage"));
const SubmitScorePage = lazy(() => import("@/student/domains/submit/pages/SubmitScorePage"));
const SubmitAssignmentPage = lazy(() => import("@/student/domains/submit/pages/SubmitAssignmentPage"));
const MyInventoryPage = lazy(() => import("@/student/domains/inventory/pages/MyInventoryPage"));

const GradesPage = lazy(() => import("@/student/domains/grades/pages/GradesPage"));
const GradeListPage = lazy(() => import("@/student/domains/grades/pages/GradeListPage"));
const GradeDetailPage = lazy(() => import("@/student/domains/grades/pages/GradeDetailPage"));
const MorePage = lazy(() => import("@/student/domains/more/pages/MorePage"));
const ProfilePage = lazy(() => import("@/student/domains/profile/pages/ProfilePage"));
const QnaPage = lazy(() => import("@/student/domains/qna/pages/QnaPage"));
const NoticesPage = lazy(() => import("@/student/domains/notices/pages/NoticesPage"));
const NoticeDetailPage = lazy(() => import("@/student/domains/notices/pages/NoticeDetailPage"));
const NotificationsPage = lazy(() => import("@/student/domains/notifications/pages/NotificationsPage"));
const ClinicIDCardPage = lazy(() => import("@/student/domains/clinic-idcard/pages/ClinicIDCardPage"));
const ClinicPage = lazy(() => import("@/student/domains/clinic/pages/ClinicPage"));
const AttendancePage = lazy(() => import("@/student/domains/attendance/pages/AttendancePage"));
const StudentSettingsPage = lazy(() => import("@/student/domains/settings/pages/StudentSettingsPage"));

/** Suspense fallback: 로딩 중 표시 (가벼운 UI로 첫 페인트 빠르게) */
function StudentRouteFallback() {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        color: "var(--stu-muted)",
        fontSize: 14,
      }}
    >
      불러오는 중…
    </div>
  );
}

export default function StudentRouter() {
  return (
    <Suspense fallback={<StudentRouteFallback />}>
    <Routes>
      <Route element={<StudentLayout />}>
        <Route index element={<Navigate to="/student/dashboard" replace />} />

        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="video" element={<VideoHomePage />} />
        <Route path="video/courses/public" element={<CourseDetailPage />} />
        <Route path="video/courses/:lectureId" element={<CourseDetailPage />} />
        <Route path="video/sessions/:sessionId" element={<VideoSessionDetailPage />} />
        <Route path="video/play" element={<VideoPlayerPage />} />

        <Route path="sessions" element={<SessionListPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />

        <Route path="submit" element={<SubmitHubPage />} />
        <Route path="submit/score" element={<SubmitScorePage />} />
        <Route path="submit/assignment" element={<SubmitAssignmentPage />} />
        <Route path="inventory" element={<MyInventoryPage />} />
        <Route path="exams" element={<ExamListPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/submit" element={<ExamSubmitPage />} />
        <Route path="exams/:examId/result" element={<ExamResultPage />} />

        <Route path="grades" element={<GradesPage />} />
        <Route path="grades/all" element={<GradeListPage />} />
        <Route path="grades/exams/:examId" element={<GradeDetailPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<StudentSettingsPage />} />
        <Route path="qna" element={<QnaPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:id" element={<NoticeDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="idcard" element={<ClinicIDCardPage />} />
        <Route path="clinic" element={<ClinicPage />} />
        <Route path="attendance" element={<AttendancePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
    </Suspense>
  );
}
