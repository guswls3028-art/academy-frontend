// PATH: src/promo/PromoRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import PromoLayout from "./layout/PromoLayout";
import LandingPage from "./pages/LandingPage";
import FeaturesPage from "./pages/FeaturesPage";
import AiGradingPage from "./pages/AiGradingPage";
import VideoPlatformPage from "./pages/VideoPlatformPage";
import PricingPage from "./pages/PricingPage";
import FaqPage from "./pages/FaqPage";
import ContactPage from "./pages/ContactPage";
import DemoPage from "./pages/DemoPage";

export default function PromoRouter() {
  return (
    <Routes>
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
