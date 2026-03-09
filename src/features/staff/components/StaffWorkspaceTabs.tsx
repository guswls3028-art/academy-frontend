// PATH: src/features/staff/components/StaffWorkspaceTabs.tsx
// Tab bar: uses global design system .ds-tabs / .ds-tab. Preserves staffId, year, month when switching.

import { useLocation, useNavigate } from "react-router-dom";

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
    <div className="ds-tabs ds-tabs--flat" role="tablist" aria-orientation="horizontal">
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
            className={`ds-tab ${isActive ? "is-active" : ""}`}
            onClick={() => navigate(buildPath(tab.path))}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
