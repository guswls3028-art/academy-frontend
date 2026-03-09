// PATH: src/features/staff/pages/MonthLockPage/MonthLockPage.tsx
// 월 마감: 월 단위 확정 (이번 달 수정 불가)

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import MonthLockPanel from "../OperationsPage/MonthLockPanel";
import { EmptyState } from "@/shared/ui/ds";
import "../../styles/staff-area.css";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

export default function MonthLockPage() {
  const [params] = useSearchParams();
  const staffId = Number(params.get("staffId"));
  const { year, month } = useMemo(getThisMonth, []);
  const monthText = useMemo(() => ymLabel(year, month), [year, month]);

  return (
    <div className="staff-area grid grid-cols-[320px_1fr] gap-6 min-h-0">
      <div className="staff-panel flex flex-col min-h-0">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원 선택</div>
          <p className="staff-helper mt-1">선택한 직원의 해당 월을 마감합니다.</p>
        </div>
        <div className="staff-panel__body overflow-y-auto min-h-0">
          <StaffOperationTable selectedStaffId={staffId} basePath="month-lock" />
        </div>
      </div>

      <div className="staff-panel min-h-[320px] flex flex-col overflow-hidden">
        <div className="staff-panel__header">
          <div className="staff-page-title">월 마감</div>
          <p className="staff-helper mt-1">{staffId ? monthText : "직원을 선택하세요."}</p>
        </div>
        {!staffId ? (
          <div className="staff-empty flex-1">
            <EmptyState
              scope="panel"
              tone="empty"
              title="직원이 선택되지 않았습니다."
              description="좌측에서 직원을 선택하면 해당 월 마감(급여 확정)을 수행할 수 있습니다."
            />
          </div>
        ) : (
          <WorkMonthProvider staffId={staffId} year={year} month={month}>
            <div className="staff-panel__body overflow-y-auto flex-1">
              <MonthLockPanel />
            </div>
          </WorkMonthProvider>
        )}
      </div>
    </div>
  );
}
