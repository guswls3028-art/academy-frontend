// PATH: src/features/materials/routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import MaterialsLayout from "./layout/MaterialsLayout";
import SheetsListPage from "./sheets/SheetsListPage";
import SheetsCreatePage from "./sheets/SheetsCreatePage";
import SheetsEditPage from "./sheets/SheetsEditPage";
import ReportsPage from "./reports/ReportsPage";
import MessagesPage from "./messages/MessagesPage";

export default function MaterialsRoutes() {
  return (
    <Routes>
      <Route element={<MaterialsLayout />}>
        <Route index element={<Navigate to="sheets" replace />} />
        <Route path="sheets" element={<SheetsListPage />} />
        <Route path="sheets/new" element={<SheetsCreatePage />} />
        <Route path="sheets/:sheetId/edit" element={<SheetsEditPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="messages" element={<MessagesPage />} />
      </Route>
    </Routes>
  );
}
