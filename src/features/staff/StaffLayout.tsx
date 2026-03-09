// PATH: src/features/staff/StaffLayout.tsx
// 직원 관리: 홈 | 급여. 급여 구간은 staff-centered workspace (좌 패널 + 우 헤더/탭/콘텐츠)
import "./styles/staff-area.css";
import { Outlet, useLocation } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { StaffWorkspace } from "./components/StaffWorkspace";

const STAFF_MAIN_TABS = [
  { key: "home", label: "홈", path: "/admin/staff/home" },
  {
    key: "payroll",
    label: "급여",
    path: "/admin/staff/attendance",
    activePaths: [
      "/admin/staff/attendance",
      "/admin/staff/expenses",
      "/admin/staff/month-lock",
      "/admin/staff/payroll-snapshot",
      "/admin/staff/reports",
    ],
  },
];

const PAYROLL_ROUTES = ["attendance", "expenses", "month-lock", "payroll-snapshot", "reports"];

function isPayrollRoute(pathname: string) {
  return PAYROLL_ROUTES.some(
    (p) => pathname === `/admin/staff/${p}` || pathname.startsWith(`/admin/staff/${p}/`)
  );
}

export default function StaffLayout() {
  const location = useLocation();
  const payroll = isPayrollRoute(location.pathname);

  return (
    <DomainLayout
      title="직원 관리"
      description="홈 · 급여(근태 · 비용/경비 · 월 마감 · 급여 스냅샷 · 리포트/명세)"
      tabs={STAFF_MAIN_TABS}
    >
      <div className="staff-area">
        {payroll ? <StaffWorkspace /> : <Outlet />}
      </div>
    </DomainLayout>
  );
}
