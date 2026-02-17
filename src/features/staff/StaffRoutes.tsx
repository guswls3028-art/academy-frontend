import { Routes, Route, Navigate } from "react-router-dom";

import StaffLayout from "./StaffLayout";

import HomePage from "./pages/HomePage/HomePage";
import AttendancePage from "./pages/AttendancePage/AttendancePage";
import ExpensesPage from "./pages/ExpensesPage/ExpensesPage";
import MonthLockPage from "./pages/MonthLockPage/MonthLockPage";
import PayrollSnapshotPage from "./pages/PayrollSnapshotPage/PayrollSnapshotPage";
import ReportsPage from "./pages/ReportsPage/ReportsPage";
import StaffDetailOverlay from "./overlays/StaffDetailOverlay/StaffDetailOverlay";

export default function StaffRoutes() {
  return (
    <Routes>
      <Route element={<StaffLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="month-lock" element={<MonthLockPage />} />
        <Route path="payroll-snapshot" element={<PayrollSnapshotPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      {/* 직원 상세는 레이아웃 분리 (Overlay 성격) */}
      <Route path=":staffId/*" element={<StaffDetailOverlay />} />
    </Routes>
  );
}
