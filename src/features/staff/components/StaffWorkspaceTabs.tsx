// PATH: src/features/staff/components/StaffWorkspaceTabs.tsx
// Tab bar that preserves staffId, year, month when switching tabs

import { useSearchParams, useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { key: "attendance", label: "근태", path: "/admin/staff/attendance" },
  { key: "expenses", label: "비용/경비", path: "/admin/staff/expenses" },
  { key: "month-lock", label: "월 마감", path: "/admin/staff/month-lock" },
  { key: "payroll-snapshot", label: "급여 스냅샷", path: "/admin/staff/payroll-snapshot" },
  { key: "reports", label: "리포트/명세", path: "/admin/staff/reports" },
];

type Props = {
  staffId: number | null;
  year: number;
  month: number;
};

export function StaffWorkspaceTabs({ staffId, year, month }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const buildPath = (tabPath: string) => {
    const params = new URLSearchParams();
    if (staffId != null) params.set("staffId", String(staffId));
    params.set("year", String(year));
    params.set("month", String(month));
    return `${tabPath}?${params.toString()}`;
  };

  return (
    <div
      className="staff-workspace-tabs flex flex-wrap gap-0 border-b-2 border-[var(--color-border-divider)] pb-0 mb-4"
      role="tablist"
    >
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.path || pathname.startsWith(tab.path + "/");
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label} 탭`}
            className={`staff-workspace-tabs__tab px-4 py-3 text-sm font-semibold transition-all duration-150 ${
              isActive
                ? "staff-workspace-tabs__tab--active bg-[var(--color-primary)] text-white border-b-2 border-[var(--color-primary)] -mb-0.5 rounded-t-lg"
                : "staff-workspace-tabs__tab--inactive text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] border-b-2 border-transparent -mb-0.5 rounded-t-lg"
            }`}
            onClick={() => navigate(buildPath(tab.path))}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
