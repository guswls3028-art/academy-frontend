// PATH: src/app/router/AppRouter.tsx
// --------------------------------------------------
// AppRouter
// - AppLayout은 각 Router(Admin/Student) 내부에서만 사용
// - 여기서는 절대 AppLayout으로 감싸지 않는다 (❗ 중요)
// --------------------------------------------------

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

import LoginPage from "@/features/auth/pages/LoginPage";
import AdminRouter from "./AdminRouter";
import StudentRouter from "@/student/app/StudentRouter";
import useAuth from "@/features/auth/hooks/useAuth";

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.tenantRole;

  // 관리자 계열 → admin
  if (["owner", "admin", "teacher", "staff"].includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  // 학생 / 부모 → student
  if (["student", "parent"].includes(role)) {
    return <Navigate to="/student" replace />;
  }

  // 이론상 도달 불가 (안전 가드)
  return <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* ================= Public ================= */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ================= Student ================= */}
      <Route
        element={
          <ProtectedRoute allow={["student", "parent"]} />
        }
      >
        <Route path="/student/*" element={<StudentRouter />} />
      </Route>

      {/* ================= Admin ================= */}
      <Route
        element={
          <ProtectedRoute allow={["owner", "admin", "teacher", "staff"]} />
        }
      >
        <Route path="/admin/*" element={<AdminRouter />} />
      </Route>

      {/* ================= Fallback ================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
