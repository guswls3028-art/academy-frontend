/**
 * 학생 앱 라우터 — 모바일 전용, 5탭(홈|영상|일정|QnA|더보기)
 */
import { Navigate, Route, Routes } from "react-router-dom";
import StudentLayout from "@/student/shared/ui/layout/StudentLayout";

import DashboardPage from "@/student/domains/dashboard/pages/DashboardPage";
import VideoHomePage from "@/student/domains/video/pages/VideoHomePage";
import CourseDetailPage from "@/student/domains/video/pages/CourseDetailPage";
import VideoSessionDetailPage from "@/student/domains/video/pages/SessionDetailPage";
import VideoPlayerPage from "@/student/domains/video/pages/VideoPlayerPage";

import SessionListPage from "@/student/domains/sessions/pages/SessionListPage";
import SessionDetailPage from "@/student/domains/sessions/pages/SessionDetailPage";

import ExamListPage from "@/student/domains/exams/pages/ExamListPage";
import ExamDetailPage from "@/student/domains/exams/pages/ExamDetailPage";
import ExamSubmitPage from "@/student/domains/exams/pages/ExamSubmitPage";
import ExamResultPage from "@/student/domains/exams/pages/ExamResultPage";
import SubmitHubPage from "@/student/domains/submit/pages/SubmitHubPage";
import SubmitScorePage from "@/student/domains/submit/pages/SubmitScorePage";
import SubmitAssignmentPage from "@/student/domains/submit/pages/SubmitAssignmentPage";

import GradesPage from "@/student/domains/grades/pages/GradesPage";
import MorePage from "@/student/domains/more/pages/MorePage";
import ProfilePage from "@/student/domains/profile/pages/ProfilePage";
import QnaPage from "@/student/domains/qna/pages/QnaPage";
import NoticesPage from "@/student/domains/notices/pages/NoticesPage";
import NoticeDetailPage from "@/student/domains/notices/pages/NoticeDetailPage";
import NotificationsPage from "@/student/domains/notifications/pages/NotificationsPage";
import ClinicIDCardPage from "@/student/domains/clinic-idcard/pages/ClinicIDCardPage";
import ClinicPage from "@/student/domains/clinic/pages/ClinicPage";
import ClinicBookingPage from "@/student/domains/clinic/pages/ClinicBookingPage";
import AttendancePage from "@/student/domains/attendance/pages/AttendancePage";

export default function StudentRouter() {
  return (
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
                <Route path="clinic/booking" element={<ClinicBookingPage />} />
        <Route path="attendance" element={<AttendancePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
