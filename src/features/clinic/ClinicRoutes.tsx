import { Routes, Route, Navigate } from "react-router-dom";
import ClinicLayout from "./ClinicLayout";

import ClinicHomePage from "./pages/HomePage/ClinicHomePage";
import ClinicOperationsPage from "./pages/OperationsPage/ClinicOperationsPage";
import ClinicReportsPage from "./pages/ReportsPage/ClinicReportsPage";
import ClinicSettingsPage from "./pages/SettingsPage/ClinicSettingsPage";
import ClinicBookingsPage from "./pages/BookingsPage/ClinicBookingsPage";

export default function ClinicRoutes() {
  return (
    <Routes>
      <Route element={<ClinicLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<ClinicHomePage />} />
        <Route path="operations" element={<ClinicOperationsPage />} />
        <Route path="bookings" element={<ClinicBookingsPage />} />
        <Route path="reports" element={<ClinicReportsPage />} />
        <Route path="settings" element={<ClinicSettingsPage />} />
      </Route>
    </Routes>
  );
}
