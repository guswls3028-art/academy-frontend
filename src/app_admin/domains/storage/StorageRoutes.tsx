// PATH: src/app_admin/domains/storage/StorageRoutes.tsx
// 자료실 — 매치업 + 저장소 통합 라우팅

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import StorageLayout from "./StorageLayout";
import MyStoragePage from "./pages/MyStoragePage";
import StudentInventoryPage from "./pages/StudentInventoryPage";

const MatchupPage = lazy(() => import("./pages/MatchupPage"));
const HitReportListPage = lazy(() => import("./pages/HitReportListPage"));
const ProposalReviewPage = lazy(() => import("./pages/ProposalReviewPage"));

function StudentRedirect() {
  const { studentPs } = useParams<{ studentPs: string }>();
  return <Navigate to={`/admin/storage/students/${studentPs}`} replace />;
}

export default function StorageRoutes() {
  return (
    <Routes>
      <Route element={<StorageLayout />}>
        {/* 기본: 매치업 탭으로 리다이렉트 */}
        <Route index element={<Navigate to="matchup" replace />} />

        {/* 매치업 */}
        <Route
          path="matchup/*"
          element={
            <Suspense fallback={null}>
              <MatchupPage />
            </Suspense>
          }
        />

        {/* 저장소 (기존) */}
        <Route path="files" element={<MyStoragePage />} />
        <Route path="students" element={<StudentInventoryPage />} />
        <Route path="students/:studentPs" element={<StudentInventoryPage />} />
        <Route path="student/:studentPs" element={<StudentRedirect />} />

        {/* 적중 보고서 — 자료저장소 3번째 탭 */}
        <Route
          path="hit-reports"
          element={
            <Suspense fallback={null}>
              <HitReportListPage />
            </Suspense>
          }
        />

        {/* Stage 6.3A — 자동 분리 검수 큐 (Proposal Review v1) */}
        <Route
          path="proposals"
          element={
            <Suspense fallback={null}>
              <ProposalReviewPage />
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to="/admin/storage/matchup" replace />} />
      </Route>
    </Routes>
  );
}
