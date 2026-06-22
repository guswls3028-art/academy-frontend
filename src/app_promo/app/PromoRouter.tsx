// PATH: src/app_promo/app/PromoRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import PromoLayout from "../layout/PromoLayout";

const LandingPage = lazy(() => import("../domains/landing/pages/LandingPage"));
const FeaturesPage = lazy(() => import("../domains/landing/pages/FeaturesPage"));
const AiGradingPage = lazy(() => import("../domains/landing/pages/AiGradingPage"));
const VideoPlatformPage = lazy(() => import("../domains/landing/pages/VideoPlatformPage"));
const PricingPage = lazy(() => import("../domains/landing/pages/PricingPage"));
const FaqPage = lazy(() => import("../domains/landing/pages/FaqPage"));
const ContactPage = lazy(() => import("../domains/landing/pages/ContactPage"));
const DemoPage = lazy(() => import("../domains/landing/pages/DemoPage"));
const LandingSamplesPage = lazy(() => import("@/landing/pages/LandingSamplesPage"));
const ParentTrustPage = lazy(() => import("../domains/landing/pages/ParentTrustPage"));
const routeFallback = <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">불러오는 중…</div>;

type PromoPage = LazyExoticComponent<ComponentType>;

function renderPromoPage(Page: PromoPage) {
  return (
    <Suspense fallback={routeFallback}>
      <Page />
    </Suspense>
  );
}

export default function PromoRouter() {
  return (
    <Routes>
      {/* 랜딩 샘플은 PromoLayout 바깥 (풀스크린 프리뷰용) */}
      <Route path="landing-samples" element={renderPromoPage(LandingSamplesPage)} />
      <Route element={<PromoLayout />}>
        <Route index element={renderPromoPage(LandingPage)} />
        <Route path="features" element={renderPromoPage(FeaturesPage)} />
        <Route path="parent-trust" element={renderPromoPage(ParentTrustPage)} />
        <Route path="ai-grading" element={renderPromoPage(AiGradingPage)} />
        <Route path="video-platform" element={renderPromoPage(VideoPlatformPage)} />
        <Route path="pricing" element={renderPromoPage(PricingPage)} />
        <Route path="faq" element={renderPromoPage(FaqPage)} />
        <Route path="contact" element={renderPromoPage(ContactPage)} />
        <Route path="demo" element={renderPromoPage(DemoPage)} />
        <Route path="*" element={<Navigate to="/promo" replace />} />
      </Route>
    </Routes>
  );
}
