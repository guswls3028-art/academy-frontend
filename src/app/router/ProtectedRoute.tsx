// PATH: src/app/router/ProtectedRoute.tsx

import { Navigate, Outlet } from "react-router-dom";
import useAuth from "@/features/auth/hooks/useAuth";

export type Role =
  | "owner"
  | "admin"
  | "teacher"
  | "staff"
  | "student"
  | "parent";

const ADMIN_ROLES: Role[] = ["owner", "admin", "teacher", "staff"];
const STUDENT_ROLES: Role[] = ["student", "parent"];

export default function ProtectedRoute({
  allow,
}: {
  allow: Role[];
}) {
  const { user, isLoading } = useAuth();

  // 🔄 auth 로딩 중
  if (isLoading) {
    return null;
  }

  // 🔒 비로그인
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role: Role | undefined = user.tenantRole;

  // ❌ tenantRole 자체가 없으면 운영 사고 → 강제 로그아웃
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  // ❌ 허용되지 않은 role
  if (!allow.includes(role)) {
    if (ADMIN_ROLES.includes(role)) {
      return <Navigate to="/admin" replace />;
    }

    if (STUDENT_ROLES.includes(role)) {
      return <Navigate to="/student" replace />;
    }

    // 미래 role 대비 안전 가드
    return <Navigate to="/login" replace />;
  }

  // ✅ 통과
  return <Outlet />;
}
