// PATH: src/app/router/AuthRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginEntry from "@/features/auth/pages/login/LoginEntry";
import HakwonPlusLoginPage from "@/features/auth/pages/login/HakwonPlusLoginPage";
import CustomLoginPage from "@/features/auth/pages/login/CustomLoginPage";
import TenantLoginPage from "@/features/auth/pages/login/TenantLoginPage";

export default function AuthRouter() {
  return (
    <Routes>
      <Route index element={<LoginEntry />} />
      <Route path="hakwonplus" element={<HakwonPlusLoginPage />} />
      <Route path="tchul" element={<TenantLoginPage tenantId={2} />} />
      <Route path="limglish" element={<TenantLoginPage tenantId={3} />} />
      <Route path="ymath" element={<TenantLoginPage tenantId={4} />} />
      <Route path="custom" element={<CustomLoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
