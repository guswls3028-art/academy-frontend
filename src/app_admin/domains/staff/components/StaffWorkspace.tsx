// PATH: src/app_admin/domains/staff/components/StaffWorkspace.tsx
// Staff-centered workspace: overview uses full width; selected staff keeps list + detail.
// Selected staff and month persist across tab switches via URL.

import { useMemo } from "react";
import { useSearchParams, useLocation, Outlet } from "react-router";
import StaffOperationTable from "../pages/OperationsPage/StaffOperationTable";
import { StaffWorkspaceHeader } from "./StaffWorkspaceHeader";
import { StaffWorkspaceTabs } from "./StaffWorkspaceTabs";
import { StaffPayrollOverview } from "./StaffPayrollOverview";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Derive basePath from pathname for staff list navigation (e.g. /workspace/staff/attendance -> attendance) */
function getBasePath(pathname: string): "attendance" | "expenses" | "month-lock" | "payroll-snapshot" | "reports" {
  const segment = pathname.replace(/^\/workspace\/staff\/?/, "").split("/")[0] || "";
  if (segment === "expenses") return "expenses";
  if (segment === "month-lock") return "month-lock";
  if (segment === "payroll-snapshot") return "payroll-snapshot";
  if (segment === "reports") return "reports";
  return "attendance";
}

export function StaffWorkspace() {
  const [params] = useSearchParams();
  const location = useLocation();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : null;
  const initialYm = useMemo(getThisMonth, []);
  const year = params.get("year") ? Number(params.get("year")) : initialYm.year;
  const month = params.get("month") ? Number(params.get("month")) : initialYm.month;
  const basePath = getBasePath(location.pathname);

  return (
    <div
      className={`staff-workspace-grid${staffId ? "" : " staff-workspace-grid--overview"}`}
      data-no-internal-header
    >
      {/* 직원 선택 후에는 목록을 유지해 상세 대상을 빠르게 바꾼다. */}
      {staffId && (
        <div className="staff-panel flex flex-col min-h-0">
          <div className="staff-panel__header">
            <div className="staff-page-title">직원</div>
            <p className="staff-helper mt-1">선택한 직원의 근태·비용·급여를 조회합니다.</p>
          </div>
          <div className="staff-panel__body overflow-y-auto min-h-0">
            <StaffOperationTable
              selectedStaffId={staffId}
              basePath={basePath}
              year={year}
              month={month}
            />
          </div>
        </div>
      )}

      {/* RIGHT: Workspace */}
      <div className="staff-panel min-h-[420px] flex flex-col overflow-hidden">
        {staffId == null ? (
          <StaffPayrollOverview year={year} month={month} />
        ) : (
          <>
            <StaffWorkspaceHeader staffId={staffId} year={year} month={month} />
            <div className="staff-panel__body overflow-y-auto flex-1 pt-4">
              <div className="mb-5">
                <StaffWorkspaceTabs staffId={staffId} year={year} month={month} />
              </div>
              <Outlet />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
