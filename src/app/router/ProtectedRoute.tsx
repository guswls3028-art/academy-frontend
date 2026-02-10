// PATH: src/app/router/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import useAuth from "@/features/auth/hooks/useAuth";
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

export default function ProtectedRoute({ allow }: { allow: Role[] }) {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();

  if (programLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role: Role | undefined = user.tenantRole ?? undefined;

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(role)) {
    if (ADMIN_ROLES.includes(role)) {
      return <Navigate to="/admin" replace />;
    }

    if (STUDENT_ROLES.includes(role)) {
      return <Navigate to="/student" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
