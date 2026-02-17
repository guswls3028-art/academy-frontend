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
import { RedirectToCommunityMaterials, RedirectToCommunityNotice } from "@/features/community/RedirectToCommunity";
import LectureDdayPage from "@/features/lectures/pages/ddays/LectureDdayPage";
import LectureAttendanceMatrixPage from "@/features/lectures/pages/attendance/LectureAttendanceMatrixPage";

/* ================= Sessions ================= */
import SessionLayout from "@/features/sessions/layout/SessionLayout";
import SessionDetailPage from "@/features/sessions/pages/SessionDetailPage";

/* ================= Video ================= */
import VideoDetailPage from "@/features/videos/pages/VideoDetailPage";

/* ================= Community ================= */
import CommunityPage from "@/features/community/pages/CommunityPage";
import QnaBoardPage from "@/features/community/pages/QnaBoardPage";
import MaterialsBoardPage from "@/features/community/pages/MaterialsBoardPage";
import CommunityAdminPage from "@/features/community/pages/CommunityAdminPage";
import CommunitySettingsPage from "@/features/community/pages/CommunitySettingsPage";

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

/* ================= Storage ================= */
import StorageRoutes from "@/features/storage/StorageRoutes";

/* ================= Messages ================= */
import { MessageRoutes } from "@/features/messages/routes";

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
          <Route path="materials" element={<RedirectToCommunityMaterials />} />
          <Route path="board" element={<RedirectToCommunityNotice />} />
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
          <Route index element={<SessionDetailPage />} />
          <Route path="attendance" element={<SessionDetailPage />} />
          <Route path="scores" element={<SessionDetailPage />} />
          <Route path="exams" element={<SessionDetailPage />} />
          <Route path="assignments" element={<SessionDetailPage />} />
          <Route path="videos" element={<SessionDetailPage />} />
          <Route path="videos/:videoId" element={<VideoDetailPage />} />
        </Route>

        {/* ================= Materials ================= */}
        <Route path="materials/*" element={<MaterialsRoutes />} />

        {/* ================= Storage (저장소 통합) ================= */}
        <Route path="storage/*" element={<StorageRoutes />} />

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
        <Route path="message/*" element={<MessageRoutes />} />

        {/* ================= Community ================= */}
        <Route path="community" element={<CommunityPage />}>
          <Route index element={<Navigate to="admin" replace />} />
          <Route path="notice" element={<Navigate to="/admin/community/admin?tab=notice" replace />} />
          <Route path="qna" element={<QnaBoardPage />} />
          <Route path="materials" element={<MaterialsBoardPage />} />
          <Route path="admin" element={<CommunityAdminPage />} />
          <Route path="settings" element={<CommunitySettingsPage />} />
        </Route>

        {/* ================= Staff ================= */}
        <Route path="staff/*" element={<StaffRoutes />} />

        {/* ================= 설정 (시스템 설정 · 내 계정 탭) ================= */}
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="system" replace />} />
          <Route path="system" element={<SettingsPage />} />
          <Route path="account" element={<ProfileAccountPage />} />
        </Route>

        {/* ================= Profile (근태 · 지출 — 내 계정은 설정 탭으로) ================= */}
        <Route path="profile" element={<ProfileLayout />}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="account" element={<Navigate to="/admin/settings/account" replace />} />
          <Route path="attendance" element={<ProfileAttendancePage />} />
          <Route path="expense" element={<ProfileExpensePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
