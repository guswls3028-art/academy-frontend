// PATH: src/app_admin/domains/staff/components/StaffWorkspace.tsx
// Staff-centered workspace: left = staff list, right = header + tabs + tab content.
// Selected staff and month persist across tab switches via URL.

import { useMemo } from "react";
import { useSearchParams, useLocation, Outlet } from "react-router-dom";
import { User } from "lucide-react";
import StaffOperationTable from "../pages/OperationsPage/StaffOperationTable";
import { StaffWorkspaceHeader } from "./StaffWorkspaceHeader";
import { StaffWorkspaceTabs } from "./StaffWorkspaceTabs";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Derive basePath from pathname for staff list navigation (e.g. /admin/staff/attendance -> attendance) */
function getBasePath(pathname: string): "attendance" | "expenses" | "month-lock" | "payroll-snapshot" | "reports" {
  const segment = pathname.replace(/^\/admin\/staff\/?/, "").split("/")[0] || "";
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
    <div className="grid grid-cols-[300px_1fr] gap-6 min-h-0" data-no-internal-header>
      {/* LEFT: Staff list */}
      <div className="staff-panel flex flex-col min-h-0">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원</div>
          <p className="staff-helper mt-1">선택한 직원의 근태·비용·급여를 조회합니다.</p>
        </div>
        <div className="staff-panel__body overflow-y-auto min-h-0">
          <StaffOperationTable
            selectedStaffId={staffId ?? undefined}
            basePath={basePath}
            year={year}
            month={month}
          />
        </div>
      </div>

      {/* RIGHT: Workspace */}
      <div className="staff-panel min-h-[420px] flex flex-col overflow-hidden">
        {staffId == null ? (
          <div
            className="staff-empty flex-1 flex flex-col items-center justify-center py-16"
            role="status"
            aria-live="polite"
            aria-label="직원이 선택되지 않았습니다. 좌측 목록에서 직원을 선택하세요."
          >
            <User className="staff-empty__icon" strokeWidth={1.5} aria-hidden />
            <p className="staff-empty__title">직원이 선택되지 않았습니다</p>
            <p className="staff-empty__desc">좌측 목록에서 직원을 선택하면 근태·비용·급여를 조회·관리할 수 있습니다.</p>
          </div>
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
