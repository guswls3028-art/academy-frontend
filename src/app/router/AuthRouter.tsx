// PATH: src/app/router/AuthRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginEntry from "@/features/auth/pages/login/LoginEntry";
import HakwonPlusLoginPage from "@/features/auth/pages/login/HakwonPlusLoginPage";
import CustomLoginPage from "@/features/auth/pages/login/CustomLoginPage";

export default function AuthRouter() {
  return (
    <Routes>
      <Route index element={<LoginEntry />} />
      <Route path="hakwonplus" element={<HakwonPlusLoginPage />} />
      <Route path="custom" element={<CustomLoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
