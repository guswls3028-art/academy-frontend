// PATH: src/features/auth/pages/login/LoginEntry.tsx
// 테넌트별 로그인 라우팅: hostname → tenant id → /login/{hakwonplus|tchul|limglish|ymath}
import { Navigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import { resolveTenantCode, getTenantIdFromCode } from "@/shared/tenant";

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
  const path = tenantId ? TENANT_ID_TO_PATH[tenantId] : "/login/hakwonplus";

  return <Navigate to={path} replace />;
}
