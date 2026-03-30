// PATH: src/promo/PromoRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import PromoLayout from "./layout/PromoLayout";
import LandingPage from "./pages/LandingPage";
import FeaturesPage from "./pages/FeaturesPage";
import AiGradingPage from "./pages/AiGradingPage";
import VideoPlatformPage from "./pages/VideoPlatformPage";
import PricingPage from "./pages/PricingPage";
import FaqPage from "./pages/FaqPage";
import ContactPage from "./pages/ContactPage";
import DemoPage from "./pages/DemoPage";

const LandingSamplesPage = lazy(() => import("@/features/landing/pages/LandingSamplesPage"));

export default function PromoRouter() {
  return (
    <Routes>
      {/* 랜딩 샘플은 PromoLayout 바깥 (풀스크린 프리뷰용) */}
      <Route path="landing-samples" element={<Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#666", fontSize: 14 }}>불러오는 중…</div>}><LandingSamplesPage /></Suspense>} />
      <Route element={<PromoLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="ai-grading" element={<AiGradingPage />} />
        <Route path="video-platform" element={<VideoPlatformPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="demo" element={<DemoPage />} />
        <Route path="*" element={<Navigate to="/promo" replace />} />
      </Route>
    </Routes>
  );
}
