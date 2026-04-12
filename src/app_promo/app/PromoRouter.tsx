// PATH: src/app_promo/app/PromoRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import PromoLayout from "../layout/PromoLayout";
import LandingPage from "../domains/landing/pages/LandingPage";
import FeaturesPage from "../domains/landing/pages/FeaturesPage";
import AiGradingPage from "../domains/landing/pages/AiGradingPage";
import VideoPlatformPage from "../domains/landing/pages/VideoPlatformPage";
import PricingPage from "../domains/landing/pages/PricingPage";
import FaqPage from "../domains/landing/pages/FaqPage";
import ContactPage from "../domains/landing/pages/ContactPage";
import DemoPage from "../domains/landing/pages/DemoPage";

const LandingSamplesPage = lazy(() => import("@/landing/pages/LandingSamplesPage"));

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
