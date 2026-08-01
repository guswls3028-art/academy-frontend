// PATH: src/app_promo/app/PromoRouter.tsx
import { Routes, Route, Navigate } from "react-router";
import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import PromoLayout from "../layout/PromoLayout";
import layoutStyles from "../layout/PromoLayout.module.css";

const LandingPage = lazy(() => import("../domains/landing/pages/LandingPage"));
const FeaturesPage = lazy(() => import("../domains/landing/pages/FeaturesPage"));
const MatchupPptPage = lazy(() => import("../domains/landing/pages/MatchupPptPage"));
const AiGradingPage = lazy(() => import("../domains/landing/pages/AiGradingPage"));
const VideoPlatformPage = lazy(() => import("../domains/landing/pages/VideoPlatformPage"));
const PricingPage = lazy(() => import("../domains/landing/pages/PricingPage"));
const UpdatesPage = lazy(() => import("../domains/landing/pages/UpdatesPage"));
const FaqPage = lazy(() => import("../domains/landing/pages/FaqPage"));
const ContactPage = lazy(() => import("../domains/landing/pages/ContactPage"));
const DemoPage = lazy(() => import("../domains/landing/pages/DemoPage"));
const LandingSamplesPage = lazy(() => import("@/landing/pages/LandingSamplesPage"));
const ParentTrustPage = lazy(() => import("../domains/landing/pages/ParentTrustPage"));
const routeFallback = (
  <div className={layoutStyles.routeFallback} role="status" aria-live="polite">
    <span aria-hidden="true" />
    <strong>학원플러스 화면을 준비하고 있습니다</strong>
    <p>잠시만 기다려주세요.</p>
  </div>
);

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
        <Route path="matchup-ppt" element={renderPromoPage(MatchupPptPage)} />
        <Route path="parent-trust" element={renderPromoPage(ParentTrustPage)} />
        <Route path="ai-grading" element={renderPromoPage(AiGradingPage)} />
        <Route path="video-platform" element={renderPromoPage(VideoPlatformPage)} />
        <Route path="pricing" element={renderPromoPage(PricingPage)} />
        <Route path="updates" element={renderPromoPage(UpdatesPage)} />
        <Route path="faq" element={renderPromoPage(FaqPage)} />
        <Route path="contact" element={renderPromoPage(ContactPage)} />
        <Route path="demo" element={renderPromoPage(DemoPage)} />
        <Route path="*" element={<Navigate to="/promo" replace />} />
      </Route>
    </Routes>
  );
}
