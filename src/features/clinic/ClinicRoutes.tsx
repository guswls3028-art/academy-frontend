// PATH: src/features/clinic/ClinicRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import ClinicLayout from "./ClinicLayout";
import ClinicBookingsPage from "./pages/BookingsPage/ClinicBookingsPage";
import ClinicHomePage from "./pages/HomePage/ClinicHomePage";
import ClinicOperationsConsolePage from "./pages/OperationsConsolePage/ClinicOperationsConsolePage";
import ClinicReportsPage from "./pages/ReportsPage/ClinicReportsPage";
import ClinicSettingsPage from "./pages/SettingsPage/ClinicSettingsPage";
import ClinicMsgSettingsPage from "./pages/MsgSettingsPage/ClinicMsgSettingsPage";

export default function ClinicRoutes() {
  return (
    <Routes>
      <Route element={<ClinicLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<ClinicHomePage />} />
        <Route path="schedule" element={<Navigate to="/admin/clinic/operations" replace />} />
        <Route path="operations" element={<ClinicOperationsConsolePage />} />
        <Route path="bookings" element={<ClinicBookingsPage />} />
        <Route path="reports" element={<ClinicReportsPage />} />
        <Route path="settings" element={<ClinicSettingsPage />} />
        <Route path="msg-settings" element={<ClinicMsgSettingsPage />} />
      </Route>
    </Routes>
  );
}
