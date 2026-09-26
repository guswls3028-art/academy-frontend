// PATH: src/app_admin/domains/clinic/ClinicRoutes.tsx
import { Routes, Route, Navigate, useLocation } from "react-router";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

const ClinicLayout = lazy(() => import("./ClinicLayout"));
const ClinicWorkPage = lazy(() => import("./pages/WorkPage/ClinicWorkPage"));
const ClinicHomePage = lazy(() => import("./pages/HomePage/ClinicHomePage"));
const ClinicSchedulePage = lazy(() => import("./pages/SchedulePage/ClinicSchedulePage"));
const ClinicReportsPage = lazy(() => import("./pages/ReportsPage/ClinicReportsPage"));
const ClinicMsgSettingsPage = lazy(() => import("./pages/MsgSettingsPage/ClinicMsgSettingsPage"));
const ClinicPasscardPage = lazy(() => import("./pages/PasscardPage/ClinicPasscardPage"));

function LegacyBookingsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("panel", "unresolved");
  return <Navigate to={`/workspace/clinic/operations?${params.toString()}`} replace />;
}

export default function ClinicRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(ClinicLayout)}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={renderLazyRoute(ClinicHomePage)} />
        <Route path="schedule" element={renderLazyRoute(ClinicSchedulePage)} />
        <Route path="operations" element={renderLazyRoute(ClinicWorkPage)} />
        <Route path="bookings" element={<LegacyBookingsRedirect />} />
        <Route path="reports" element={renderLazyRoute(ClinicReportsPage)} />
        <Route path="settings" element={renderLazyRoute(ClinicPasscardPage)} />
        <Route path="msg-settings" element={renderLazyRoute(ClinicMsgSettingsPage)} />
      </Route>
    </Routes>
  );
}
