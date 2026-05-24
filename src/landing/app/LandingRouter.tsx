import { Navigate, Route, Routes } from "react-router-dom";

import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";

const PublicLandingPage = lazy(() => import("@/landing/pages/PublicLandingPage"));
const LandingReportDetailPage = lazy(() => import("@/landing/pages/LandingReportDetailPage"));
const LandingReportsListPage = lazy(() => import("@/landing/pages/LandingReportsListPage"));
const LandingShareReportPage = lazy(() => import("@/landing/pages/LandingShareReportPage"));
const LandingCommunityListPage = lazy(() => import("@/landing/pages/LandingCommunityListPage"));
const LandingCommunityPostPage = lazy(() => import("@/landing/pages/LandingCommunityPostPage"));
const LandingCommunityWritePage = lazy(() => import("@/landing/pages/LandingCommunityWritePage"));
const LandingBoardPage = lazy(() => import("@/landing/pages/LandingBoardPage"));
const LandingBoardDetailPage = lazy(() => import("@/landing/pages/LandingBoardDetailPage"));
const LandingBoardWritePage = lazy(() => import("@/landing/pages/LandingBoardWritePage"));
const LandingBoardEditPage = lazy(() => import("@/landing/pages/LandingBoardEditPage"));
const LandingReviewsPage = lazy(() => import("@/landing/pages/LandingReviewsPage"));
const LandingReviewDetailPage = lazy(() => import("@/landing/pages/LandingReviewDetailPage"));
const LandingReviewWritePage = lazy(() => import("@/landing/pages/LandingReviewWritePage"));
const LandingScoresListPage = lazy(() =>
  import("@/landing/pages/LandingScoresPage").then((m) => ({ default: m.LandingScoresListPage }))
);
const LandingScoresDetailPage = lazy(() =>
  import("@/landing/pages/LandingScoresPage").then((m) => ({ default: m.LandingScoresDetailPage }))
);
const LandingMatchupBoardAdminPage = lazy(() => import("@/landing/admin/LandingMatchupBoardAdminPage"));
const LandingMatchupBoardPage = lazy(() => import("@/landing/pages/LandingMatchupBoardPage"));
const LandingMatchupBoardDetailPage = lazy(() => import("@/landing/pages/LandingMatchupBoardDetailPage"));
const LandingAboutPage = lazy(() => import("@/landing/pages/LandingAboutPage"));
const LandingGuidePage = lazy(() => import("@/landing/pages/LandingGuidePage"));

export default function LandingRouter() {
  return (
    <Routes>
      <Route index element={<PublicLandingPage />} />
      <Route path="reports" element={<LandingReportsListPage />} />
      <Route path="reports/:reportId" element={<LandingReportDetailPage />} />
      <Route path="share/:token" element={<LandingShareReportPage />} />
      <Route path="community/:boardType" element={<LandingCommunityListPage />} />
      <Route path="community/:boardType/posts/:postId" element={<LandingCommunityPostPage />} />
      <Route path="community/:boardType/write" element={<LandingCommunityWritePage />} />
      <Route path="board" element={<LandingBoardPage />} />
      <Route path="board/write" element={<LandingBoardWritePage />} />
      <Route path="board/:postId" element={<LandingBoardDetailPage />} />
      <Route path="board/:postId/edit" element={<LandingBoardEditPage />} />
      <Route path="reviews" element={<LandingReviewsPage />} />
      <Route path="reviews/write" element={<LandingReviewWritePage />} />
      <Route path="reviews/:reviewId" element={<LandingReviewDetailPage />} />
      <Route path="scores" element={<LandingScoresListPage />} />
      <Route path="scores/:id" element={<LandingScoresDetailPage />} />
      <Route path="about" element={<LandingAboutPage />} />
      <Route path="guide" element={<LandingGuidePage />} />
      <Route path="matchup-board" element={<LandingMatchupBoardPage />} />
      <Route path="matchup-board/:id" element={<LandingMatchupBoardDetailPage />} />
      <Route path="admin/matchup-board" element={<LandingMatchupBoardAdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
