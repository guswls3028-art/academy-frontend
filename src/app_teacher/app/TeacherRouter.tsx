/**
 * PATH: src/app_teacher/app/TeacherRouter.tsx
 * 선생님 전용 모바일 앱 라우터 — 하단 4탭(오늘|강의|학생|커뮤니티) + 헤더 햄버거 드로어
 */
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { Navigate, Route, Routes } from "react-router-dom";
import TeacherLayout from "@teacher/layout/TeacherLayout";
import RoleGuard from "@teacher/shared/ui/RoleGuard";

/* === Domain pages (lazy) === */
const TodayPage = lazy(() => import("@teacher/domains/today/pages/TodayPage"));
const LectureListPage = lazy(() => import("@teacher/domains/lectures/pages/LectureListPage"));
const LectureDetailPage = lazy(() => import("@teacher/domains/lectures/pages/LectureDetailPage"));
const SessionDetailPage = lazy(() => import("@teacher/domains/lectures/pages/SessionDetailPage"));
const SwipeAttendancePage = lazy(() => import("@teacher/domains/attendance/pages/SwipeAttendancePage"));
const MobileScoreEntryPage = lazy(() => import("@teacher/domains/scores/pages/MobileScoreEntryPage"));
const StudentListPage = lazy(() => import("@teacher/domains/students/pages/StudentListPage"));
const StudentDetailPage = lazy(() => import("@teacher/domains/students/pages/StudentDetailPage"));
const CommunicationPage = lazy(() => import("@teacher/domains/comms/pages/CommunicationPage"));
const MessageLogPage = lazy(() => import("@teacher/domains/comms/pages/MessageLogPage"));
const MessageTemplatesPage = lazy(() => import("@teacher/domains/comms/pages/MessageTemplatesPage"));
const MessagingSettingsPage = lazy(() => import("@teacher/domains/comms/pages/MessagingSettingsPage"));
const NotificationsPage = lazy(() => import("@teacher/domains/notifications/pages/NotificationsPage"));
const ProfilePage = lazy(() => import("@teacher/domains/profile/pages/ProfilePage"));
const TeacherSettingsPage = lazy(() => import("@teacher/domains/settings/pages/TeacherSettingsPage"));
const AttendanceMatrixPage = lazy(() => import("@teacher/domains/lectures/pages/AttendanceMatrixPage"));
const StaffManagePage = lazy(() => import("@teacher/domains/staff/pages/StaffManagePage"));
const StaffDetailPage = lazy(() => import("@teacher/domains/staff/pages/StaffDetailPage"));
const MyRecordsPage = lazy(() => import("@teacher/domains/profile/pages/MyRecordsPage"));

/* Phase 3 */
const ExamListPage = lazy(() => import("@teacher/domains/exams/pages/ExamListPage"));
const ExamDetailPage = lazy(() => import("@teacher/domains/exams/pages/ExamDetailPage"));
const ExamTemplatesPage = lazy(() => import("@teacher/domains/exams/pages/ExamTemplatesPage"));
const ExamBundlesPage = lazy(() => import("@teacher/domains/exams/pages/ExamBundlesPage"));
const OmrPage = lazy(() => import("@teacher/domains/exams/pages/OmrPage"));
const HomeworkDetailPage = lazy(() => import("@teacher/domains/exams/pages/HomeworkDetailPage"));
const VideoListPage = lazy(() => import("@teacher/domains/videos/pages/VideoListPage"));
const VideoDetailPage = lazy(() => import("@teacher/domains/videos/pages/VideoDetailPage"));
const ClinicPage = lazy(() => import("@teacher/domains/clinic/pages/ClinicPage"));
const ClinicReportsPage = lazy(() => import("@teacher/domains/clinic/pages/ClinicReportsPage"));
const ClinicRemoteControlPage = lazy(() => import("@teacher/domains/clinic/pages/ClinicRemoteControlPage"));
const CounselingPage = lazy(() => import("@teacher/domains/counseling/pages/CounselingPage"));
const ResultsPage = lazy(() => import("@teacher/domains/results/pages/ResultsPage"));
const SubmissionsInboxPage = lazy(() => import("@teacher/domains/results/pages/SubmissionsInboxPage"));
const BillingPage = lazy(() => import("@teacher/domains/profile/pages/BillingPage"));
const DesktopOnlyPage = lazy(() => import("@teacher/domains/profile/pages/DesktopOnlyPage"));

/* Phase 4 — 데스크톱에서 이식한 도메인 */
const FeesDashboardPage = lazy(() => import("@teacher/domains/fees/pages/FeesDashboardPage"));
const FeesInvoicesPage = lazy(() => import("@teacher/domains/fees/pages/FeesInvoicesPage"));
const MyStoragePage = lazy(() => import("@teacher/domains/storage/pages/MyStoragePage"));
const StudentInventoryPage = lazy(() => import("@teacher/domains/storage/pages/StudentInventoryPage"));
const OrganizationSettingsPage = lazy(() => import("@teacher/domains/settings/pages/OrganizationSettingsPage"));
const AppearancePage = lazy(() => import("@teacher/domains/settings/pages/AppearancePage"));
const StopwatchPage = lazy(() => import("@teacher/domains/tools/pages/StopwatchPage"));
const PatchNotesPage = lazy(() => import("@teacher/domains/developer/pages/DeveloperPages").then((m) => ({ default: m.PatchNotesPage })));
const BugReportPage = lazy(() => import("@teacher/domains/developer/pages/DeveloperPages").then((m) => ({ default: m.BugReportPage })));
const FeedbackPage = lazy(() => import("@teacher/domains/developer/pages/DeveloperPages").then((m) => ({ default: m.FeedbackPage })));

function TeacherFallback() {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        color: "var(--tc-text-muted)",
        fontSize: 14,
      }}
    >
      불러오는 중...
    </div>
  );
}

export default function TeacherRouter() {
  return (
    <Suspense fallback={<TeacherFallback />}>
      <Routes>
        <Route element={<TeacherLayout />}>
          <Route index element={<TodayPage />} />

          {/* 수업 */}
          <Route path="classes" element={<LectureListPage />} />
          <Route path="classes/:lectureId" element={<LectureDetailPage />} />
          <Route path="classes/:lectureId/sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="classes/:lectureId/attendance-matrix" element={<AttendanceMatrixPage />} />

          {/* 출석 (세션 기반) */}
          <Route path="attendance/:sessionId" element={<SwipeAttendancePage />} />

          {/* 성적 입력 */}
          <Route path="scores/:sessionId" element={<MobileScoreEntryPage />} />

          {/* 학생 */}
          <Route path="students" element={<StudentListPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />

          {/* 소통 */}
          <Route path="comms" element={<CommunicationPage />} />
          <Route path="message-log" element={<MessageLogPage />} />
          <Route path="message-templates" element={<MessageTemplatesPage />} />
          <Route path="messaging-settings" element={<RoleGuard allow={["owner", "admin"]}><MessagingSettingsPage /></RoleGuard>} />
          <Route path="notifications" element={<NotificationsPage />} />

          {/* 시험/과제 (Phase 3) */}
          <Route path="exams" element={<ExamListPage />} />
          <Route path="exams/templates" element={<ExamTemplatesPage />} />
          <Route path="exams/bundles" element={<ExamBundlesPage />} />
          <Route path="exams/:examId" element={<ExamDetailPage />} />
          <Route path="exams/:examId/omr" element={<OmrPage />} />
          <Route path="homeworks/:homeworkId" element={<HomeworkDetailPage />} />

          {/* 영상 (Phase 3) */}
          <Route path="videos" element={<VideoListPage />} />
          <Route path="videos/:videoId" element={<VideoDetailPage />} />

          {/* 클리닉 (Phase 3, section_mode) */}
          <Route path="clinic" element={<ClinicPage />} />
          <Route path="clinic/reports" element={<ClinicReportsPage />} />
          <Route path="clinic/remote" element={<ClinicRemoteControlPage />} />

          {/* 상담 메모 (Phase 3) */}
          <Route path="counseling" element={<CounselingPage />} />

          {/* 성적 조회 */}
          <Route path="results" element={<ResultsPage />} />

          {/* 제출함 (시험·과제 처리 인박스) */}
          <Route path="submissions" element={<SubmissionsInboxPage />} />

          {/* 프로필 / 설정 */}
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<TeacherSettingsPage />} />
          <Route path="staff" element={<RoleGuard allow={["owner", "admin"]}><StaffManagePage /></RoleGuard>} />
          <Route path="staff/:staffId" element={<RoleGuard allow={["owner", "admin"]}><StaffDetailPage /></RoleGuard>} />
          <Route path="my-records" element={<MyRecordsPage />} />
          <Route path="billing" element={<RoleGuard allow={["owner", "admin"]}><BillingPage /></RoleGuard>} />
          <Route path="desktop-only" element={<DesktopOnlyPage />} />

          {/* 수납 (Phase 4) */}
          <Route path="fees" element={<RoleGuard allow={["owner", "admin"]}><FeesDashboardPage /></RoleGuard>} />
          <Route path="fees/invoices" element={<RoleGuard allow={["owner", "admin"]}><FeesInvoicesPage /></RoleGuard>} />

          {/* 자료실 (Phase 4) */}
          <Route path="storage" element={<MyStoragePage />} />
          <Route path="storage/inventory" element={<StudentInventoryPage />} />

          {/* 설정 — 조직·외관 (Phase 4) */}
          <Route path="settings/organization" element={<RoleGuard allow={["owner", "admin"]}><OrganizationSettingsPage /></RoleGuard>} />
          <Route path="settings/appearance" element={<AppearancePage />} />

          {/* 도구 — 스톱워치 (Phase 4) */}
          <Route path="tools/stopwatch" element={<StopwatchPage />} />

          {/* To개발자 (Phase 4) */}
          <Route path="developer" element={<PatchNotesPage />} />
          <Route path="developer/bug" element={<BugReportPage />} />
          <Route path="developer/feedback" element={<FeedbackPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </Suspense>
  );
}
