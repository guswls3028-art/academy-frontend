// PATH: src/app/router/AdminRouter.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/shared/ui/layout";

/* ================= Dashboard ================= */
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

/* ================= Students ================= */
import StudentsPage from "@/features/students/pages/StudentsPage";
import StudentsDetailPage from "@/features/students/pages/StudentsDetailPage";

/* ================= Lectures ================= */
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

/* ================= Materials (NEW) ================= */
import { MaterialsRoutes } from "@/features/materials";

/* ================= Placeholder ================= */
const CounselPage = () => <div className="p-6">상담 페이지</div>;
const NoticePage = () => <div className="p-6">공지 페이지</div>;
const MessagePage = () => <div className="p-6">메시지 페이지</div>;

export default function AdminRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentsDetailPage />} />

        <Route path="lectures" element={<LecturesPage />} />
        <Route path="lectures/:lectureId" element={<LectureLayout />}>
          <Route index element={<LectureStudentsPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="board" element={<LectureBoardPage />} />
          <Route path="ddays" element={<LectureDdayPage />} />
          <Route path="attendance" element={<LectureAttendanceMatrixPage />} />
          <Route path="report" element={<LectureReportPage />} />
          <Route path="sessions" element={<LectureSessionsPage />} />
        </Route>

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

        {/* ================= Materials (NEW) ================= */}
        <Route path="materials/*" element={<MaterialsRoutes />} />

        {/* ✅ 여기 핵심 */}
        <Route path="clinic/*" element={<ClinicRoutes />} />

        <Route path="counsel" element={<CounselPage />} />
        <Route path="notice" element={<NoticePage />} />
        <Route path="message" element={<MessagePage />} />

        <Route path="community" element={<CommunityPage />}>
          <Route index element={<NoticeBoardPage />} />
          <Route path="notice" element={<NoticeBoardPage />} />
          <Route path="qna" element={<QnaBoardPage />} />
          <Route path="review" element={<ReviewBoardPage />} />
        </Route>

        <Route path="staff/*" element={<StaffRoutes />} />

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
