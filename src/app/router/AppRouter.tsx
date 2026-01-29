// PATH: src/app/router/AppRouter.tsx
// --------------------------------------------------
// AppRouter
// - AppLayout은 각 Router(Admin/Student) 내부에서만 사용한다
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

  if (isLoading) return <div>loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return user.is_staff ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/student" replace />
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ================= Student ================= */}
      <Route element={<ProtectedRoute role="student" />}>
        <Route path="/student/*" element={<StudentRouter />} />
      </Route>

      {/* ================= Admin ================= */}
      <Route element={<ProtectedRoute role="staff" />}>
        <Route path="/admin/*" element={<AdminRouter />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
