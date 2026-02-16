// PATH: src/features/auth/pages/login/LoginEntry.tsx
// 테넌트별 로그인: hostname이 테넌트 도메인이면 /login 에서 바로 해당 로그인 폼 (URL은 /login 유지)
import { Navigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import { resolveTenantCode, getTenantIdFromCode } from "@/shared/tenant";
import TenantLoginPage from "./TenantLoginPage";

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

  const resolved = resolveTenantCode();
  const code = resolved.ok ? resolved.code : program.tenantCode;
  const tenantId = getTenantIdFromCode(code);

  // 호스트가 테넌트 도메인(tchul/limglish/ymath)이면 /login 에서 바로 해당 로그인 폼 렌더 (URL 예쁘게 유지)
  if (resolved.ok && resolved.source === "hostname" && tenantId && tenantId !== 1) {
    return <TenantLoginPage tenantId={tenantId} />;
  }

  const path = tenantId ? TENANT_ID_TO_PATH[tenantId] : "/login/hakwonplus";
  return <Navigate to={path} replace />;
}
