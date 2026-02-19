// PATH: src/features/auth/pages/login/LoginEntry.tsx
// 테넌트별 로그인: hostname이 테넌트 도메인이면 /login 에서 바로 해당 로그인 폼 (URL은 항상 /login 만 노출)
import { Navigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import { resolveTenantCode, getTenantIdFromCode, getTenantCodeFromHostname } from "@/shared/tenant";
import TenantLoginPage from "./TenantLoginPage";
import TchulLoginPage from "./TchulLoginPage";

const TENANT_ID_TO_PATH: Record<1 | 2 | 3 | 4, string> = {
  1: "/login/hakwonplus",
  2: "/login/tchul",
  3: "/login/limglish",
  4: "/login/ymath",
};

export default function LoginEntry() {
  const { program, isLoading } = useProgram();

  if (isLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  // 테넌트 전용 도메인(tchul/limglish/ymath)이면 무조건 /login 에서 폼 표시 (storage 무시, URL 항상 /login)
  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) {
    const hostTenantId = getTenantIdFromCode(fromHost.code);
    if (hostTenantId === 2) return <TchulLoginPage />;
    if (hostTenantId && hostTenantId !== 1) return <TenantLoginPage tenantId={hostTenantId} />;
  }

  const resolved = resolveTenantCode();
  const code = resolved.ok ? resolved.code : program.tenantCode;
  const tenantId = getTenantIdFromCode(code);
  const path = tenantId ? TENANT_ID_TO_PATH[tenantId] : "/login/hakwonplus";
  return <Navigate to={path} replace />;
}
