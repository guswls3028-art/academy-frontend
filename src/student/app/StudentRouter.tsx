// PATH: C:\academyfront\src\student\app\StudentRouter.tsx
/**
 * ✅ StudentRouter (LOCK v3)
 *
 * 변경 요약:
 * - 원본 라우팅 구조 100% 유지
 * - Layout import만 SSOT(shared/ui) 기준으로 교체
 *
 * 주의:
 * - 라우트/도메인/주석 절대 변경 없음
 * - “합치기” 요청에 따라 기존 코드 존중
 */

import { Navigate, Route, Routes } from "react-router-dom";

// ✅ SSOT 전역 레이아웃 (shared/ui)
import StudentLayout from "@/student/shared/ui/layout/StudentLayout";

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

// ✅ Media
import MediaPlayerPage from "@/student/domains/media/pages/MediaPlayerPage";

// 🚑 임시 데모 (홍보/캡쳐 전용)
import MediaDemoPage from "@/student/domains/media/pages/MediaDemoPage";

import ClinicIDCardPage from "@/student/domains/clinic-idcard/pages/ClinicIDCardPage";
import ProfilePage from "@/student/domains/profile/pages/ProfilePage";

export default function StudentRouter() {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* ✅ Dashboard (행동 허브) */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* ✅ 내 정보 (프로필 사진 업로드) */}
        <Route path="profile" element={<ProfilePage />} />

        {/* ✅ Sessions (허브) */}
        <Route path="sessions" element={<SessionListPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />

        {/* ✅ Video (실제 재생) */}
        <Route path="video" element={<MediaPlayerPage />} />

        {/* 🚑 Video Demo (임시 검증/홍보용) */}
        <Route path="video/demo" element={<MediaDemoPage />} />

        {/* ✅ Exams */}
        <Route path="exams" element={<ExamListPage />} />
        <Route path="exams/:examId" element={<ExamDetailPage />} />
        <Route path="exams/:examId/submit" element={<ExamSubmitPage />} />
        <Route path="exams/:examId/result" element={<ExamResultPage />} />

        {/* ✅ Grades */}
        <Route path="grades" element={<GradesPage />} />

        {/* ✅ QnA */}
        <Route path="qna" element={<QnaPage />} />

        {/* ✅ Clinic ID Card (하원 체크 전용) */}
        <Route path="idcard" element={<ClinicIDCardPage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
