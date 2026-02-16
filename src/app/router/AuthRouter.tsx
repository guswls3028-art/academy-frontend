// PATH: src/app/router/AuthRouter.tsx
import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginEntry from "@/features/auth/pages/login/LoginEntry";
import HakwonPlusLoginPage from "@/features/auth/pages/login/HakwonPlusLoginPage";
import CustomLoginPage from "@/features/auth/pages/login/CustomLoginPage";
import TenantLoginPage from "@/features/auth/pages/login/TenantLoginPage";
import { getTenantCodeFromHostname, getTenantIdFromCode } from "@/shared/tenant";

/** 테넌트 도메인에서 /login/코드 로 들어오면 /login 으로 리다이렉트 (URL은 항상 도메인/login 만 노출) */
function TenantLoginOrRedirect({
  tenantId,
  children,
}: {
  tenantId: 2 | 3 | 4;
  children: ReactNode;
}) {
  const fromHost = getTenantCodeFromHostname();
  const fromHostId = fromHost.ok ? getTenantIdFromCode(fromHost.code) : null;
  if (fromHostId === tenantId) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function AuthRouter() {
  return (
    <Routes>
      <Route index element={<LoginEntry />} />
      <Route path="hakwonplus" element={<HakwonPlusLoginPage />} />
      <Route
        path="tchul"
        element={
          <TenantLoginOrRedirect tenantId={2}>
            <TenantLoginPage tenantId={2} />
          </TenantLoginOrRedirect>
        }
      />
      <Route
        path="limglish"
        element={
          <TenantLoginOrRedirect tenantId={3}>
            <TenantLoginPage tenantId={3} />
          </TenantLoginOrRedirect>
        }
      />
      <Route
        path="ymath"
        element={
          <TenantLoginOrRedirect tenantId={4}>
            <TenantLoginPage tenantId={4} />
          </TenantLoginOrRedirect>
        }
      />
      <Route path="custom" element={<CustomLoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
