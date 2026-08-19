// PATH: src/app_admin/domains/staff/StaffLayout.tsx
// 직원 관리: 홈 | 급여. 급여 구간은 staff-centered workspace (좌 패널 + 우 헤더/탭/콘텐츠)
import "./styles/staff-area.css";
import { Outlet, useLocation, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DomainLayout } from "@/shared/ui/layout";
import { StaffWorkspace } from "./components/StaffWorkspace";
import { fetchStaffMe } from "@/shared/staff/api";
import { staffQueryKeys } from "./queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";

const STAFF_MAIN_TABS = [
  { key: "home", label: "홈", path: "/workspace/staff/home" },
  {
    key: "payroll",
    label: "급여",
    path: "/workspace/staff/attendance",
    activePaths: [
      "/workspace/staff/attendance",
      "/workspace/staff/expenses",
      "/workspace/staff/month-lock",
      "/workspace/staff/payroll-snapshot",
      "/workspace/staff/reports",
    ],
  },
  { key: "settings", label: "설정", path: "/workspace/staff/settings" },
];

const PAYROLL_ROUTES = ["attendance", "expenses", "month-lock", "payroll-snapshot", "reports"];

function isPayrollRoute(pathname: string) {
  return PAYROLL_ROUTES.some(
    (p) => pathname === `/workspace/staff/${p}` || pathname.startsWith(`/workspace/staff/${p}/`)
  );
}

export default function StaffLayout() {
  const location = useLocation();
  const {
    data: staffMe,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: staffQueryKeys.me, queryFn: fetchStaffMe });
  const payroll = isPayrollRoute(location.pathname);

  if (isLoading) {
    return <EmptyState scope="page" tone="loading" title="직원 관리 권한을 확인하는 중…" />;
  }
  if (isError || !staffMe) {
    return (
      <EmptyState
        scope="page"
        tone="error"
        title="직원 관리 권한을 확인할 수 없습니다"
        actions={
          <Button intent="secondary" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }
  if (!staffMe.is_payroll_manager) {
    return <Navigate to="/workspace/dashboard" replace />;
  }

  return (
    <DomainLayout
      title="직원 관리"
      description="홈 · 직원 운영(근태 · 선결제 환급 · 월 마감 · 정산 참고 · 리포트)"
      tabs={STAFF_MAIN_TABS}
    >
      <div className="staff-area">
        {payroll ? <StaffWorkspace /> : <Outlet />}
      </div>
    </DomainLayout>
  );
}
