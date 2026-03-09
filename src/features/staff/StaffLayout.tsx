// PATH: src/features/staff/StaffLayout.tsx
// 도메인 헤더: 홈 | 급여(하위: 근태·비용/경비·월 마감·급여 스냅샷·리포트)
import "./styles/staff-area.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

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

const PAYROLL_SUB_TABS = [
  { key: "attendance", label: "근태", path: "/admin/staff/attendance" },
  { key: "expenses", label: "비용/경비", path: "/admin/staff/expenses" },
  { key: "month-lock", label: "월 마감", path: "/admin/staff/month-lock" },
  { key: "payroll-snapshot", label: "급여 스냅샷", path: "/admin/staff/payroll-snapshot" },
  { key: "reports", label: "리포트/명세", path: "/admin/staff/reports" },
];

function StaffSubTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const isPayrollRoute = PAYROLL_SUB_TABS.some(
    (t) => pathname === t.path || pathname.startsWith(t.path + "/")
  );
  if (!isPayrollRoute) return null;

  return (
    <div
      className="flex flex-wrap gap-1 border-b border-[var(--color-border-divider)] pb-3 mb-4"
      role="tablist"
    >
      {PAYROLL_SUB_TABS.map((tab) => {
        const isActive =
          pathname === tab.path || pathname === tab.path + "/" || pathname.startsWith(tab.path + "/");
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
            }`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function StaffLayout() {
  return (
    <DomainLayout
      title="직원 관리"
      description="홈 · 급여(근태 · 비용/경비 · 월 마감 · 급여 스냅샷 · 리포트/명세)"
      tabs={STAFF_MAIN_TABS}
    >
      <div className="staff-area">
        <StaffSubTabs />
        <Outlet />
      </div>
    </DomainLayout>
  );
}
