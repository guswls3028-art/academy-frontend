// PATH: src/features/storage/StorageRoutes.tsx
// 저장소 통합 관리 — 내 저장소(선생님) / 학생 인벤토리 관리

import { Routes, Route, Navigate } from "react-router-dom";
import StoragePage from "./pages/StoragePage";

export default function StorageRoutes() {
  return (
    <Routes>
      <Route index element={<StoragePage />} />
      <Route path="student/:studentPs" element={<StoragePage />} />
      <Route path="*" element={<Navigate to="/admin/storage" replace />} />
    </Routes>
  );
}
