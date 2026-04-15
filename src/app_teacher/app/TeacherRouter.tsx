/**
 * PATH: src/app_teacher/app/TeacherRouter.tsx
 * 선생님 전용 모바일 앱 라우터 — 5탭(오늘|수업|학생|소통|더보기)
 */
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { Navigate, Route, Routes } from "react-router-dom";
import TeacherLayout from "@teacher/layout/TeacherLayout";

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
const NotificationsPage = lazy(() => import("@teacher/domains/notifications/pages/NotificationsPage"));
const ProfilePage = lazy(() => import("@teacher/domains/profile/pages/ProfilePage"));

/* Phase 3 */
const ExamListPage = lazy(() => import("@teacher/domains/exams/pages/ExamListPage"));
const ExamDetailPage = lazy(() => import("@teacher/domains/exams/pages/ExamDetailPage"));
const HomeworkDetailPage = lazy(() => import("@teacher/domains/exams/pages/HomeworkDetailPage"));
const VideoListPage = lazy(() => import("@teacher/domains/videos/pages/VideoListPage"));
const VideoDetailPage = lazy(() => import("@teacher/domains/videos/pages/VideoDetailPage"));
const ClinicPage = lazy(() => import("@teacher/domains/clinic/pages/ClinicPage"));
const CounselingPage = lazy(() => import("@teacher/domains/counseling/pages/CounselingPage"));

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

          {/* 출석 (세션 기반) */}
          <Route path="attendance/:sessionId" element={<SwipeAttendancePage />} />

          {/* 성적 입력 */}
          <Route path="scores/:sessionId" element={<MobileScoreEntryPage />} />

          {/* 학생 */}
          <Route path="students" element={<StudentListPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />

          {/* 소통 */}
          <Route path="comms" element={<CommunicationPage />} />
          <Route path="notifications" element={<NotificationsPage />} />

          {/* 시험/과제 (Phase 3) */}
          <Route path="exams" element={<ExamListPage />} />
          <Route path="exams/:examId" element={<ExamDetailPage />} />
          <Route path="homeworks/:homeworkId" element={<HomeworkDetailPage />} />

          {/* 영상 (Phase 3) */}
          <Route path="videos" element={<VideoListPage />} />
          <Route path="videos/:videoId" element={<VideoDetailPage />} />

          {/* 클리닉 (Phase 3, section_mode) */}
          <Route path="clinic" element={<ClinicPage />} />

          {/* 상담 메모 (Phase 3) */}
          <Route path="counseling" element={<CounselingPage />} />

          {/* 프로필 */}
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </Suspense>
  );
}
