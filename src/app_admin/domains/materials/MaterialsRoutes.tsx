// PATH: src/app_admin/domains/materials/MaterialsRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import MaterialsLayout from "./MaterialsLayout";
import SheetsListPage from "./sheets/SheetsListPage";
import ReportsPage from "./reports/ReportsPage";
import MessagesPage from "./messages/MessagesPage";

export default function MaterialsRoutes() {
  return (
    <Routes>
      <Route element={<MaterialsLayout />}>
        <Route index element={<Navigate to="sheets" replace />} />
        <Route path="sheets" element={<SheetsListPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="messages" element={<MessagesPage />} />
      </Route>
    </Routes>
  );
}
