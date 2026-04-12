// 로그인 라우트 — 통합 LoginPage 로 단순화
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/auth/pages/LoginPage";

export default function AuthRouter() {
  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path=":tenantCode" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
