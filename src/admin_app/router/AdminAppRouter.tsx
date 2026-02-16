// PATH: src/admin_app/router/AdminAppRouter.tsx
// Developer-only app: tenant branding, logos, images.

import { Routes, Route, Navigate } from "react-router-dom";
import AdminAppLayout from "@/admin_app/layout/AdminAppLayout";
import AdminAppHomePage from "@/admin_app/pages/AdminAppHomePage";
import TenantBrandingPage from "@/admin_app/pages/TenantBrandingPage";

export default function AdminAppRouter() {
  return (
    <Routes>
      <Route element={<AdminAppLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminAppHomePage />} />
        <Route path="branding" element={<TenantBrandingPage />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
