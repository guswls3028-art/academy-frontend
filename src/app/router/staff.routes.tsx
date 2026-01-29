import { Navigate, RouteObject } from "react-router-dom";

import HomePage from "@/features/staff/pages/HomePage/HomePage";
import OperationsPage from "@/features/staff/pages/OperationsPage/OperationsPage";
import ReportsPage from "@/features/staff/pages/ReportsPage/ReportsPage";
import StaffDetailOverlay from "@/features/staff/overlays/StaffDetailOverlay/StaffDetailOverlay";

export const staffRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="home" replace /> },

  { path: "home", element: <HomePage /> },
  { path: "operations", element: <OperationsPage /> },
  { path: "reports", element: <ReportsPage /> },

  // Overlay
  { path: ":staffId/*", element: <StaffDetailOverlay /> },
];
