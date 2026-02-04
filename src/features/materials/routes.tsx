// ======================================================================================
// FILE: src/features/materials/routes.tsx  (UPDATE)
// ======================================================================================
import { Routes, Route, Navigate } from "react-router-dom";
import MaterialsLayout from "./layout/MaterialsLayout";
import SheetsListPage from "./sheets/SheetsListPage";
import ReportsPage from "./reports/ReportsPage";
import MessagesPage from "./messages/MessagesPage";

export default function MaterialsRoutes() {
  return (
    <Routes>
      <Route element={<MaterialsLayout />}>
        <Route index element={<Navigate to="sheets" replace />} />
        <Route path="sheets" element={<SheetsListPage />} />
        {/* ✅ 생성은 모달로 처리 (페이지 라우트 제거) */}
        <Route path="reports" element={<ReportsPage />} />
        <Route path="messages" element={<MessagesPage />} />
      </Route>
    </Routes>
  );
}
