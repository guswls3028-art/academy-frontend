// PATH: src/app_admin/domains/staff/StaffRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";

const StaffLayout = lazy(() => import("./StaffLayout"));
const StaffDetailOverlay = lazy(() => import("./overlays/StaffDetailOverlay/StaffDetailOverlay"));
const AttendancePage = lazy(() => import("./pages/AttendancePage/AttendancePage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage/ExpensesPage"));
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const MonthLockPage = lazy(() => import("./pages/MonthLockPage/MonthLockPage"));
const PayrollSnapshotPage = lazy(() => import("./pages/PayrollSnapshotPage/PayrollSnapshotPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage/ReportsPage"));
const StaffSettingsPage = lazy(() => import("./pages/SettingsPage/StaffSettingsPage"));

export default function StaffRoutes() {
  return (
    <Routes>
      <Route element={renderLazyRoute(StaffLayout)}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={renderLazyRoute(HomePage)} />
        <Route path="operations" element={<Navigate to="/admin/staff/attendance" replace />} />
        <Route path="attendance" element={renderLazyRoute(AttendancePage)} />
        <Route path="expenses" element={renderLazyRoute(ExpensesPage)} />
        <Route path="month-lock" element={renderLazyRoute(MonthLockPage)} />
        <Route path="payroll-snapshot" element={renderLazyRoute(PayrollSnapshotPage)} />
        <Route path="reports" element={renderLazyRoute(ReportsPage)} />
        <Route path="settings" element={renderLazyRoute(StaffSettingsPage)} />
      </Route>

      {/* 직원 상세는 레이아웃 분리 (Overlay 성격) */}
      <Route path=":staffId/*" element={renderLazyRoute(StaffDetailOverlay)} />
    </Routes>
  );
}
