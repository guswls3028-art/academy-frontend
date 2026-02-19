// PATH: src/app/router/AuthRouter.tsx
// 로그인 라우트 — shared/tenant/tenants 레지스트리 기반
import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginEntry from "@/features/auth/pages/login/LoginEntry";
import HakwonPlusLoginPage from "@/features/auth/pages/login/HakwonPlusLoginPage";
import CustomLoginPage from "@/features/auth/pages/login/CustomLoginPage";
import TenantLoginPage from "@/features/auth/pages/login/TenantLoginPage";
import { DEDICATED_LOGIN_COMPONENTS } from "@/features/auth/pages/login/dedicatedLoginComponents";
import { getTenantCodeFromHostname, getTenantIdFromCode } from "@/shared/tenant";
import { TENANTS } from "@/shared/tenant";

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

/** 로그인 경로가 있는 프로덕션 테넌트만 (1 제외, 9999 제외) — 학원플러스는 별도 Route */
const LOGIN_ROUTE_TENANTS = TENANTS.filter(
  (t) => t.id !== 1 && t.id !== 9999
) as readonly { id: 2 | 3 | 4; code: string; loginPath: string; dedicatedLoginPage: boolean }[];

export default function AuthRouter() {
  return (
    <Routes>
      <Route index element={<LoginEntry />} />
      <Route path="hakwonplus" element={<HakwonPlusLoginPage />} />
      {LOGIN_ROUTE_TENANTS.map((t) => {
        const Dedicated = DEDICATED_LOGIN_COMPONENTS[t.id];
        return (
          <Route
            key={t.id}
            path={t.code}
            element={
              <TenantLoginOrRedirect tenantId={t.id}>
                {Dedicated ? <Dedicated /> : <TenantLoginPage tenantId={t.id} />}
              </TenantLoginOrRedirect>
            }
          />
        );
      })}
      <Route path="custom" element={<CustomLoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
