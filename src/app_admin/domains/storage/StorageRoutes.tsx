// PATH: src/app_admin/domains/storage/StorageRoutes.tsx
// 자료실 — 매치업 + 저장소 통합 라우팅

import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";
import { EmptyState } from "@/shared/ui/ds";

const StorageLayout = lazy(() => import("./StorageLayout"));
const MyStoragePage = lazy(() => import("./pages/MyStoragePage"));
const StudentInventoryPage = lazy(() => import("./pages/StudentInventoryPage"));
const MatchupPage = lazy(() => import("./pages/MatchupPage"));
const HitReportListPage = lazy(() => import("./pages/HitReportListPage"));
const ProposalReviewPage = lazy(() => import("./pages/ProposalReviewPage"));

function StorageRouteFallback() {
  return (
    <EmptyState
      scope="panel"
      tone="loading"
      title="자료 화면을 불러오는 중..."
      description="용량이 큰 자료나 검수 화면은 여는 데 몇 초 걸릴 수 있습니다."
    />
  );
}

function StudentRedirect() {
  const { studentPs } = useParams<{ studentPs: string }>();
  return <Navigate to={`/admin/storage/students/${studentPs}`} replace />;
}

export default function StorageRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(StorageLayout, <StorageRouteFallback />)}>
        {/* 기본: 매치업 탭으로 리다이렉트 */}
        <Route index element={<Navigate to="matchup" replace />} />

        {/* 매치업 */}
        <Route
          path="matchup/*"
          element={renderLazyRoute(MatchupPage, <StorageRouteFallback />)}
        />

        {/* 저장소 (기존) */}
        <Route path="files" element={renderLazyRoute(MyStoragePage, <StorageRouteFallback />)} />
        <Route path="students" element={renderLazyRoute(StudentInventoryPage, <StorageRouteFallback />)} />
        <Route path="students/:studentPs" element={renderLazyRoute(StudentInventoryPage, <StorageRouteFallback />)} />
        <Route path="student/:studentPs" element={<StudentRedirect />} />

        {/* 적중 보고서 — 자료저장소 3번째 탭 */}
        <Route
          path="hit-reports"
          element={renderLazyRoute(HitReportListPage, <StorageRouteFallback />)}
        />

        {/* 자동 분리 + 직접 자른 문항 OCR 정보 제안 검수 큐 */}
        <Route
          path="proposals"
          element={renderLazyRoute(ProposalReviewPage, <StorageRouteFallback />)}
        />

        <Route path="*" element={<Navigate to="/admin/storage/matchup" replace />} />
      </Route>
    </Routes>
  );
}
