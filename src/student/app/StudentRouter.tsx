/**
 * 학생 앱 라우터 — 모바일 전용, 5탭(홈|영상|일정|성적|더보기)
 */
import { Navigate, Route, Routes } from "react-router-dom";
import StudentLayout from "@/student/shared/ui/layout/StudentLayout";

import DashboardPage from "@/student/domains/dashboard/pages/DashboardPage";
import VideoHomePage from "@/student/domains/media/pages/VideoHomePage";
import MediaPlayerPage from "@/student/domains/media/pages/MediaPlayerPage";

import SessionListPage from "@/student/domains/sessions/pages/SessionListPage";
import SessionDetailPage from "@/student/domains/sessions/pages/SessionDetailPage";

import ExamListPage from "@/student/domains/exams/pages/ExamListPage";
import ExamDetailPage from "@/student/domains/exams/pages/ExamDetailPage";
import ExamSubmitPage from "@/student/domains/exams/pages/ExamSubmitPage";
import ExamResultPage from "@/student/domains/exams/pages/ExamResultPage";

import GradesPage from "@/student/domains/grades/pages/GradesPage";
import MorePage from "@/student/domains/more/pages/MorePage";
import ProfilePage from "@/student/domains/profile/pages/ProfilePage";
import QnaPage from "@/student/domains/qna/pages/QnaPage";
import ClinicIDCardPage from "@/student/domains/clinic-idcard/pages/ClinicIDCardPage";
import AttendancePage from "@/student/domains/attendance/pages/AttendancePage";

export default function StudentRouter() {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        <Route index element={<Navigate to="/student/dashboard" replace />} />

        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="video" element={<VideoHomePage />} />
        <Route path="video/play" element={<MediaPlayerPage />} />

        <Route path="sessions" element={<SessionListPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />

        <Route path="exams" element={<ExamListPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/submit" element={<ExamSubmitPage />} />
        <Route path="exams/:examId/result" element={<ExamResultPage />} />

        <Route path="grades" element={<GradesPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="qna" element={<QnaPage />} />
        <Route path="idcard" element={<ClinicIDCardPage />} />
        <Route path="attendance" element={<AttendancePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
