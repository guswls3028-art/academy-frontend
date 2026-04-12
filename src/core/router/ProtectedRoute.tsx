// PATH: src/app/router/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

export type Role =
  | "owner"
  | "admin"
  | "teacher"
  | "staff"
  | "student"
  | "parent";

const ADMIN_ROLES: Role[] = ["owner", "admin", "teacher", "staff"];
const STUDENT_ROLES: Role[] = ["student", "parent"];

export default function ProtectedRoute({ allow, tenantOnly }: { allow: Role[]; tenantOnly?: string[] }) {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();

  if (programLoading || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--color-text-muted, #888)", fontSize: "var(--text-sm, 13px)" }}>
        불러오는 중…
      </div>
    );
  }

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  // 홍보 테넌트는 /promo 로그인 모달로, 그 외는 /login 페이지로
  const tc = program?.tenantCode;
  const isPromoTenant = tc === "hakwonplus" || tc === "9999";
  const loginRedirect = isPromoTenant
    ? <Navigate to="/promo" state={{ openLogin: true }} replace />
    : <Navigate to="/login" replace />;

  if (!user) {
    return loginRedirect;
  }

  const role: Role | undefined = user.tenantRole ?? undefined;

  if (!role) {
    return loginRedirect;
  }

  // tenantOnly: 특정 테넌트만 허용 (e.g., dev 페이지)
  if (tenantOnly && tenantOnly.length > 0) {
    const tc = program?.tenantCode;
    if (!tc || !tenantOnly.includes(tc)) {
      if (ADMIN_ROLES.includes(role)) {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  if (!allow.includes(role)) {
    if (ADMIN_ROLES.includes(role)) {
      return <Navigate to="/admin" replace />;
    }

    if (STUDENT_ROLES.includes(role)) {
      return <Navigate to="/student" replace />;
    }

    return loginRedirect;
  }

  return <Outlet />;
}
