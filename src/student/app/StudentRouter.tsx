/**
 * 학생 앱 라우터 — 모바일 전용, 5탭(홈|영상|일정|QnA|더보기)
 * TDZ 방지: lazy loading으로 청크 분리 (error→queryError 충돌 회피)
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import StudentLayout from "@/student/shared/ui/layout/StudentLayout";

const DashboardPage = lazy(() => import("@/student/domains/dashboard/pages/DashboardPage"));
const VideoHomePage = lazy(() => import("@/student/domains/video/pages/VideoHomePage"));
const CourseDetailPage = lazy(() => import("@/student/domains/video/pages/CourseDetailPage"));
const VideoSessionDetailPage = lazy(() => import("@/student/domains/video/pages/SessionDetailPage"));
import VideoPlayerPage from "@/student/domains/video/pages/VideoPlayerPage";

const SessionListPage = lazy(() => import("@/student/domains/sessions/pages/SessionListPage"));
const SessionDetailPage = lazy(() => import("@/student/domains/sessions/pages/SessionDetailPage"));

const ExamListPage = lazy(() => import("@/student/domains/exams/pages/ExamListPage"));
const ExamDetailPage = lazy(() => import("@/student/domains/exams/pages/ExamDetailPage"));
const ExamSubmitPage = lazy(() => import("@/student/domains/exams/pages/ExamSubmitPage"));
const ExamResultPage = lazy(() => import("@/student/domains/exams/pages/ExamResultPage"));
const SubmitHubPage = lazy(() => import("@/student/domains/submit/pages/SubmitHubPage"));
const SubmitScorePage = lazy(() => import("@/student/domains/submit/pages/SubmitScorePage"));
const SubmitAssignmentPage = lazy(() => import("@/student/domains/submit/pages/SubmitAssignmentPage"));

const GradesPage = lazy(() => import("@/student/domains/grades/pages/GradesPage"));
const MorePage = lazy(() => import("@/student/domains/more/pages/MorePage"));
const ProfilePage = lazy(() => import("@/student/domains/profile/pages/ProfilePage"));
const QnaPage = lazy(() => import("@/student/domains/qna/pages/QnaPage"));
const NoticesPage = lazy(() => import("@/student/domains/notices/pages/NoticesPage"));
const NoticeDetailPage = lazy(() => import("@/student/domains/notices/pages/NoticeDetailPage"));
const NotificationsPage = lazy(() => import("@/student/domains/notifications/pages/NotificationsPage"));
const ClinicIDCardPage = lazy(() => import("@/student/domains/clinic-idcard/pages/ClinicIDCardPage"));
const ClinicPage = lazy(() => import("@/student/domains/clinic/pages/ClinicPage"));
const AttendancePage = lazy(() => import("@/student/domains/attendance/pages/AttendancePage"));

/** Suspense fallback: 로딩 중 표시 */
function StudentRouteFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--stu-muted)" }}>
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
        <Route path="exams" element={<ExamListPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/submit" element={<ExamSubmitPage />} />
        <Route path="exams/:examId/result" element={<ExamResultPage />} />

        <Route path="grades" element={<GradesPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="profile" element={<ProfilePage />} />
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
