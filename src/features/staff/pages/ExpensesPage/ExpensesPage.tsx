// PATH: src/features/staff/pages/ExpensesPage/ExpensesPage.tsx
// 비용/경비: 직원별 경비 청구(교통비, 재료비 등), 정산

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import ExpensesPanel from "../OperationsPage/ExpensesPanel";
import { EmptyState } from "@/shared/ui/ds";
import "../../styles/staff-area.css";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

export default function ExpensesPage() {
  const [params] = useSearchParams();
  const staffId = Number(params.get("staffId"));
  const { year, month } = useMemo(getThisMonth, []);
  const monthText = useMemo(() => ymLabel(year, month), [year, month]);

  return (
    <div className="staff-area grid grid-cols-[320px_1fr] gap-6 min-h-0">
      <div className="staff-panel flex flex-col min-h-0">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원 선택</div>
          <p className="staff-helper mt-1">선택한 직원의 비용·경비를 조회·승인합니다.</p>
        </div>
        <div className="staff-panel__body overflow-y-auto min-h-0">
          <StaffOperationTable selectedStaffId={staffId} basePath="expenses" />
        </div>
      </div>

      <div className="staff-panel min-h-[420px] flex flex-col overflow-hidden">
        <div className="staff-panel__header">
          <div className="staff-page-title">비용 목록</div>
          <p className="staff-helper mt-1">{staffId ? `${monthText} 기준` : "직원을 선택하세요."}</p>
        </div>
        {!staffId ? (
          <div className="staff-empty flex-1">
            <EmptyState
              scope="panel"
              tone="empty"
              title="직원이 선택되지 않았습니다."
              description="좌측에서 직원을 선택하면 비용을 조회·추가·승인할 수 있습니다."
            />
          </div>
        ) : (
          <WorkMonthProvider staffId={staffId} year={year} month={month}>
            <div className="staff-panel__body overflow-y-auto flex-1">
              <ExpensesPanel />
            </div>
          </WorkMonthProvider>
        )}
      </div>
    </div>
  );
}
