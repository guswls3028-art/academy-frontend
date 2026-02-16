// PATH: src/app/router/AppRouter.tsx
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import ProtectedRoute from "./ProtectedRoute";

import AdminRouter from "./AdminRouter";
import StudentRouter from "@/student/app/StudentRouter";
import AuthRouter from "./AuthRouter";
import AdminAppRouter from "@/admin_app/router/AdminAppRouter";

import TenantRequiredPage from "@/features/auth/pages/TenantRequiredPage";
import useAuth from "@/features/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();
  const navigate = useNavigate();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (programLoading) return;
    if (!program) return;

    if (isLoading) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;

    // ✅ 핵심 수정: 비로그인 상태 명시 처리
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const role = user.tenantRole;

    // 테넌트 1번(hakwonplus) 및 9999번(로컬 개발) owner는 admin_app으로 리다이렉트
    if ((program.tenantCode === "hakwonplus" || program.tenantCode === "9999") && role === "owner") {
      navigate("/dev/home", { replace: true });
      return;
    }

    if (role && ["owner", "admin", "teacher", "staff"].includes(role)) {
      navigate("/admin", { replace: true });
      return;
    }

    if (role && ["student", "parent"].includes(role)) {
      navigate("/student", { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  }, [programLoading, program, isLoading, user, navigate]);

  if (programLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  return null;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login/*" element={<AuthRouter />} />

      <Route
        path="/error/tenant-required"
        element={<TenantRequiredPage />}
      />

      <Route path="/" element={<RootRedirect />} />

      <Route element={<ProtectedRoute allow={["student", "parent"]} />}>
        <Route path="/student/*" element={<StudentRouter />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allow={["owner", "admin", "teacher", "staff"]} />
        }
      >
        <Route path="/admin/*" element={<AdminRouter />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allow={["owner"]} />
        }
      >
        <Route path="/dev/*" element={<AdminAppRouter />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
