// PATH: src/app/router/AdminRouter.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout, DomainLayout } from "@/shared/ui/layout";

/* ================= Dashboard ================= */
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

/* ================= Students ================= */
import StudentsLayout from "@/features/students/StudentsLayout";
import StudentsHomePage from "@/features/students/pages/StudentsHomePage";
import StudentsDetailOverlay from "@/features/students/overlays/StudentsDetailOverlay";

/* ================= Lectures ================= */
import LecturesLayout from "@/features/lectures/layout/LecturesLayout";
import LecturesPage from "@/features/lectures/pages/lectures/LecturesPage";
import LectureLayout from "@/features/lectures/layout/LectureLayout";
import LectureStudentsPage from "@/features/lectures/pages/lectures/LectureStudentsPage";
import LectureReportPage from "@/features/lectures/pages/lectures/LectureReportPage";
import LectureSessionsPage from "@/features/lectures/pages/sessions/LectureSessionsPage";
import MaterialsPage from "@/features/lectures/pages/materials/MaterialsPage";
import LectureBoardPage from "@/features/lectures/pages/boards/LectureBoardPage";
import LectureDdayPage from "@/features/lectures/pages/ddays/LectureDdayPage";
import LectureAttendanceMatrixPage from "@/features/lectures/pages/attendance/LectureAttendanceMatrixPage";

/* ================= Sessions ================= */
import SessionLayout from "@/features/sessions/layout/SessionLayout";
import SessionAttendanceRoute from "@/features/sessions/routes/SessionAttendanceRoute";
import SessionScoresRoute from "@/features/sessions/routes/SessionScoresRoute";
import SessionExamsRoute from "@/features/sessions/routes/SessionExamsRoute";
import SessionAssignmentsRoute from "@/features/sessions/routes/SessionAssignmentsRoute";
import SessionVideosRoute from "@/features/sessions/routes/SessionVideosRoute";

/* ================= Video ================= */
import VideoDetailPage from "@/features/videos/pages/VideoDetailPage";

/* ================= Community ================= */
import CommunityPage from "@/features/community/pages/CommunityPage";
import NoticeBoardPage from "@/features/community/pages/NoticeBoardPage";
import QnaBoardPage from "@/features/community/pages/QnaBoardPage";
import ReviewBoardPage from "@/features/community/pages/ReviewBoardPage";

/* ================= Clinic ================= */
import ClinicRoutes from "@/features/clinic/ClinicRoutes";

/* ================= Profile ================= */
import {
  ProfileLayout,
  ProfileAccountPage,
  ProfileAttendancePage,
  ProfileExpensePage,
} from "@/features/profile";

/* ================= Staff ================= */
import StaffRoutes from "@/features/staff/StaffRoutes";

/* ================= Materials ================= */
import { MaterialsRoutes } from "@/features/materials";

/* ================= Settings ================= */
import SettingsPage from "@/features/settings/pages/SettingsPage";

/* ================= Exams / Results / Videos (Admin Root) ================= */
import ExamAdminPage from "@/features/exams/pages/ExamAdminPage";
import ResultsAdminPage from "@/features/results/pages/ResultsAdminPage";
import VideoAdminPage from "@/features/videos/pages/VideoAdminPage";

/* ================= Placeholder (DomainLayout 적용) ================= */
const CounselPage = () => (
  <DomainLayout title="상담" description="상담·코칭 관리를 한 화면에서.">
    <div className="p-6">상담 페이지</div>
  </DomainLayout>
);
const NoticePage = () => (
  <DomainLayout title="공지" description="전체 공지 관리">
    <div className="p-6">공지 페이지</div>
  </DomainLayout>
);
const MessagePage = () => (
  <DomainLayout title="메시지" description="메시지 관리">
    <div className="p-6">메시지 페이지</div>
  </DomainLayout>
);

export default function AdminRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* ================= Students (SSOT) ================= */}
        <Route path="students" element={<StudentsLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<StudentsHomePage />} />
          <Route path="deleted" element={<StudentsHomePage />} />
        </Route>

        {/* 학생 상세 (Overlay / Layout 밖) */}
        <Route path="students/:studentId" element={<StudentsDetailOverlay />} />

        {/* ================= Lectures (SSOT 동일 구조) ================= */}
        <Route path="lectures" element={<LecturesLayout />}>
          <Route index element={<LecturesPage />} />
          <Route path="past" element={<LecturesPage tab="past" />} />
        </Route>

        {/* 강의 상세 */}
        <Route path="lectures/:lectureId" element={<LectureLayout />}>
          <Route index element={<LectureStudentsPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="board" element={<LectureBoardPage />} />
          <Route path="ddays" element={<LectureDdayPage />} />
          <Route path="attendance" element={<LectureAttendanceMatrixPage />} />
          <Route path="report" element={<LectureReportPage />} />
          <Route path="sessions" element={<LectureSessionsPage />} />
        </Route>

        {/* ================= Sessions ================= */}
        <Route
          path="lectures/:lectureId/sessions/:sessionId/*"
          element={<SessionLayout />}
        >
          <Route index element={<SessionAttendanceRoute />} />
          <Route path="attendance" element={<SessionAttendanceRoute />} />
          <Route path="scores" element={<SessionScoresRoute />} />
          <Route path="exams" element={<SessionExamsRoute />} />
          <Route path="assignments" element={<SessionAssignmentsRoute />} />
          <Route path="videos" element={<SessionVideosRoute />} />
          <Route path="videos/:videoId" element={<VideoDetailPage />} />
        </Route>

        {/* ================= Materials ================= */}
        <Route path="materials/*" element={<MaterialsRoutes />} />

        {/* ================= Clinic ================= */}
        <Route path="clinic/*" element={<ClinicRoutes />} />

        {/* ================= Exams ================= */}
        <Route path="exams" element={<ExamAdminPage />} />

        {/* ================= Results ================= */}
        <Route path="results" element={<ResultsAdminPage />} />

        {/* ================= Videos (Admin Root) ================= */}
        <Route path="videos" element={<VideoAdminPage />} />

        <Route path="counsel" element={<CounselPage />} />
        <Route path="notice" element={<NoticePage />} />
        <Route path="message" element={<MessagePage />} />

        {/* ================= Community ================= */}
        <Route path="community" element={<CommunityPage />}>
          <Route index element={<Navigate to="notice" replace />} />
          <Route path="notice" element={<NoticeBoardPage />} />
          <Route path="qna" element={<QnaBoardPage />} />
          <Route path="review" element={<ReviewBoardPage />} />
        </Route>

        {/* ================= Staff ================= */}
        <Route path="staff/*" element={<StaffRoutes />} />

        {/* ================= Settings ================= */}
        <Route path="settings" element={<SettingsPage />} />

        {/* ================= Profile ================= */}
        <Route path="profile" element={<ProfileLayout />}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account" element={<ProfileAccountPage />} />
          <Route path="attendance" element={<ProfileAttendancePage />} />
          <Route path="expense" element={<ProfileExpensePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
