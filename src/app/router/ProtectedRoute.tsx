// src/app/router/ProtectedRoute.tsx

import { Navigate, Outlet } from "react-router-dom";
import useAuth from "@/features/auth/hooks/useAuth";

export default function ProtectedRoute({
  role,
}: {
  role?: "student" | "staff";
}) {
  const { user, isLoading } = useAuth();

  // 🔒 인증 판별 중
  if (isLoading || user === undefined) {
    return <div>loading...</div>;
  }

  // 🔒 비로그인
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🔒 역할 분기
  if (role === "student" && user.is_staff) {
    return <Navigate to="/admin" replace />;
  }

  if (role === "staff" && !user.is_staff) {
    return <Navigate to="/student" replace />;
  }

  // ✅ 핵심: 자식 Route 유지
  return <Outlet />;
}
