// PATH: src/admin_app/router/AdminAppRouter.tsx
// Developer-only app: tenant branding, logos, images.
// 모바일: 리스트 → 상세 메뉴 → 작업 화면(브랜딩/도메인/Owner/고급) 단계형.

import { Routes, Route, Navigate } from "react-router-dom";
import AdminAppLayout from "@/admin_app/layout/AdminAppLayout";
import AdminAppHomePage from "@/admin_app/pages/AdminAppHomePage";
import TenantBrandingPage from "@/admin_app/pages/TenantBrandingPage";
import TenantListPage from "@/admin_app/pages/TenantListPage";
import TenantDetailMenuPage from "@/admin_app/pages/TenantDetailMenuPage";
import TenantBrandingFormPage from "@/admin_app/pages/TenantBrandingFormPage";
import TenantDomainsPage from "@/admin_app/pages/TenantDomainsPage";
import TenantAdvancedPage from "@/admin_app/pages/TenantAdvancedPage";

export default function AdminAppRouter() {
  return (
    <Routes>
      <Route element={<AdminAppLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminAppHomePage />} />
        {/* 모바일 흐름: 리스트 → 상세 메뉴 → 각 설정 화면 */}
        <Route path="branding" element={<TenantListPage />} />
        <Route path="branding/:tenantId" element={<TenantDetailMenuPage />} />
        <Route path="branding/:tenantId/branding" element={<TenantBrandingFormPage />} />
        <Route path="branding/:tenantId/domains" element={<TenantDomainsPage />} />
        <Route path="branding/:tenantId/advanced" element={<TenantAdvancedPage />} />
        {/* 레거시: 단일 페이지(데스크톱용) — 필요 시 별도 path로 유지 */}
        <Route path="branding-legacy" element={<TenantBrandingPage />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
