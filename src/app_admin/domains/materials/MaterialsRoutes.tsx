// PATH: src/app_admin/domains/materials/MaterialsRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

const MaterialsLayout = lazy(() => import("./MaterialsLayout"));
const SheetsListPage = lazy(() => import("./sheets/SheetsListPage"));
const ReportsPage = lazy(() => import("./reports/ReportsPage"));
const MessagesPage = lazy(() => import("./messages/MessagesPage"));

export default function MaterialsRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(MaterialsLayout)}>
        <Route index element={<Navigate to="sheets" replace />} />
        <Route path="sheets" element={renderLazyRoute(SheetsListPage)} />
        <Route path="reports" element={renderLazyRoute(ReportsPage)} />
        <Route path="messages" element={renderLazyRoute(MessagesPage)} />
      </Route>
    </Routes>
  );
}
