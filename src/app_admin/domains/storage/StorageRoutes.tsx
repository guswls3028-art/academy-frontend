// PATH: src/app_admin/domains/storage/StorageRoutes.tsx
// 저장소 통합 관리 — DomainLayout 탭 SSOT

import { Routes, Route, Navigate, useParams } from "react-router-dom";
import StorageLayout from "./StorageLayout";
import MyStoragePage from "./pages/MyStoragePage";
import StudentInventoryPage from "./pages/StudentInventoryPage";

function StudentRedirect() {
  const { studentPs } = useParams<{ studentPs: string }>();
  return <Navigate to={`/admin/storage/students/${studentPs}`} replace />;
}

export default function StorageRoutes() {
  return (
    <Routes>
      <Route element={<StorageLayout />}>
        <Route index element={<MyStoragePage />} />
        <Route path="students" element={<StudentInventoryPage />} />
        <Route path="students/:studentPs" element={<StudentInventoryPage />} />
        {/* 하위 호환: 기존 /student/:ps → /students/:ps */}
        <Route path="student/:studentPs" element={<StudentRedirect />} />
        <Route path="*" element={<Navigate to="/admin/storage" replace />} />
      </Route>
    </Routes>
  );
}
