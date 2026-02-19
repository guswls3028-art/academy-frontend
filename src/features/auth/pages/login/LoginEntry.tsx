// PATH: src/features/auth/pages/login/LoginEntry.tsx
// 테넌트별 로그인: hostname이 테넌트 도메인이면 /login 에서 바로 해당 로그인 폼 (URL은 항상 /login 만 노출)
import { Navigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantCodeFromHostname,
  getLoginPathForTenantId,
} from "@/shared/tenant";
import TenantLoginPage from "./TenantLoginPage";
import { DEDICATED_LOGIN_COMPONENTS } from "./dedicatedLoginComponents";

export default function LoginEntry() {
  const { program, isLoading } = useProgram();

  if (isLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  // 테넌트 전용 도메인 접속 시 /login 에서 바로 해당 폼 표시 (storage 무시, URL 항상 /login)
  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) {
    const hostTenantId = getTenantIdFromCode(fromHost.code);
    if (hostTenantId != null && hostTenantId !== 1) {
      const Dedicated = hostTenantId ? DEDICATED_LOGIN_COMPONENTS[hostTenantId] : null;
      if (Dedicated) return <Dedicated />;
      return <TenantLoginPage tenantId={hostTenantId} />;
    }
  }

  const resolved = resolveTenantCode();
  const code = resolved.ok ? resolved.code : program.tenantCode;
  const tenantId = getTenantIdFromCode(code);
  const path = tenantId ? getLoginPathForTenantId(tenantId) : "/login/hakwonplus";
  return <Navigate to={path} replace />;
}
