// PATH: src/app_admin/domains/clinic/ClinicRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

const ClinicLayout = lazy(() => import("./ClinicLayout"));
const ClinicBookingsPage = lazy(() => import("./pages/BookingsPage/ClinicBookingsPage"));
const ClinicHomePage = lazy(() => import("./pages/HomePage/ClinicHomePage"));
const ClinicOperationsConsolePage = lazy(() => import("./pages/OperationsConsolePage/ClinicOperationsConsolePage"));
const ClinicReportsPage = lazy(() => import("./pages/ReportsPage/ClinicReportsPage"));
const ClinicSettingsPage = lazy(() => import("./pages/SettingsPage/ClinicSettingsPage"));
const ClinicMsgSettingsPage = lazy(() => import("./pages/MsgSettingsPage/ClinicMsgSettingsPage"));

export default function ClinicRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(ClinicLayout)}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={renderLazyRoute(ClinicHomePage)} />
        <Route path="schedule" element={<Navigate to="/admin/clinic/operations" replace />} />
        <Route path="operations" element={renderLazyRoute(ClinicOperationsConsolePage)} />
        <Route path="bookings" element={renderLazyRoute(ClinicBookingsPage)} />
        <Route path="reports" element={renderLazyRoute(ClinicReportsPage)} />
        <Route path="settings" element={renderLazyRoute(ClinicSettingsPage)} />
        <Route path="msg-settings" element={renderLazyRoute(ClinicMsgSettingsPage)} />
      </Route>
    </Routes>
  );
}
