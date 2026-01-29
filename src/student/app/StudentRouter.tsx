// src/student/app/StudentRouter.tsx
/**
 * ✅ StudentRouter (LOCK v1)
 * - 학생 앱 라우팅
 * - 레거시 student/pages 전부 무시하고, domains 기반으로 새로 구성
 *
 * 원칙:
 * - student 라우팅은 domains/pages만 바라본다
 * - features의 화면 컴포넌트를 직접 import 하지 않는다 (공용 훅/유틸은 OK)
 */

import { Navigate, Route, Routes } from "react-router-dom";
import StudentLayout from "@/student/app/StudentLayout";

// domains
import DashboardPage from "@/student/domains/dashboard/pages/DashboardPage";
import SessionListPage from "@/student/domains/sessions/pages/SessionListPage";
import SessionDetailPage from "@/student/domains/sessions/pages/SessionDetailPage";

import ExamListPage from "@/student/domains/exams/pages/ExamListPage";
import ExamDetailPage from "@/student/domains/exams/pages/ExamDetailPage";
import ExamSubmitPage from "@/student/domains/exams/pages/ExamSubmitPage";
import ExamResultPage from "@/student/domains/exams/pages/ExamResultPage";

import GradesPage from "@/student/domains/grades/pages/GradesPage";
import QnaPage from "@/student/domains/qna/pages/QnaPage";

export default function StudentRouter() {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* ✅ Dashboard (행동 허브) */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* ✅ Sessions (허브) */}
        <Route path="sessions" element={<SessionListPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />

        {/* ✅ Exams */}
        <Route path="exams" element={<ExamListPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/submit" element={<ExamSubmitPage />} />
        <Route path="exams/:examId/result" element={<ExamResultPage />} />

        {/* ✅ Grades */}
        <Route path="grades" element={<GradesPage />} />

        {/* ✅ QnA */}
        <Route path="qna" element={<QnaPage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
