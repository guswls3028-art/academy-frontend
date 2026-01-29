// src/student/app/StudentRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";

import StudentLayout from "@/student/app/StudentLayout";

// pages
import DashboardPage from "@/student/pages/DashboardPage";
import LectureListPage from "@/student/pages/LectureListPage";
import LectureDetailPage from "@/student/pages/LectureDetailPage";
import SessionDetailPage from "@/student/pages/SessionDetailPage";
import QnaPage from "@/student/pages/QnaPage";
import QnaDetailPage from "@/student/pages/QnaDetailPage";
import GradePage from "@/student/pages/GradePage";

// media
import StudentMediaPage from "@/student/media/pages/StudentMediaPage";
import StudentVideoWatchPage from "@/student/media/pages/StudentVideoWatchPage";

export default function StudentRouter() {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        {/* 기본 */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* 기존 기능 (유지) */}
        <Route path="lectures" element={<LectureListPage />} />
        <Route path="lectures/:lectureId" element={<LectureDetailPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="qna" element={<QnaPage />} />
        <Route path="qna/:qnaId" element={<QnaDetailPage />} />
        <Route path="grades" element={<GradePage />} />

        {/* ✅ 학생 영상 (강의 안 거침) */}
        <Route path="media" element={<StudentMediaPage />} />

        {/* ✅ 영상 바로 재생 */}
        <Route
          path="media/videos/:videoId"
          element={<StudentVideoWatchPage />}
        />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
