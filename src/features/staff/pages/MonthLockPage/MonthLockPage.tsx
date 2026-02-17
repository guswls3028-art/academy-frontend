// PATH: src/features/staff/pages/MonthLockPage/MonthLockPage.tsx
// 월 마감: 월 단위 확정 (이번 달 수정 불가)

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import MonthLockPanel from "../OperationsPage/MonthLockPanel";
import { EmptyState } from "@/shared/ui/ds";

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
    <div className="grid grid-cols-[320px_1fr] gap-6">
        <div className="ds-panel-card">
          <div className="ds-panel-card__header px-4 py-3">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">직원 선택</div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              좌측에서 직원을 선택한 뒤 우측에서 해당 월을 마감합니다.
            </div>
          </div>
          <div className="p-3">
            <StaffOperationTable selectedStaffId={staffId} basePath="month-lock" />
          </div>
        </div>

        <div className="ds-panel-card min-h-[320px]">
          <div className="ds-panel-card__header px-5 py-4">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">월 마감</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {staffId ? `${monthText}` : "직원을 선택하세요."}
            </div>
          </div>
          {!staffId ? (
            <div className="p-8">
              <EmptyState
                scope="panel"
                tone="empty"
                title="직원이 선택되지 않았습니다."
                description="좌측에서 직원을 선택하면 해당 월 마감(급여 확정)을 수행할 수 있습니다."
              />
            </div>
          ) : (
            <WorkMonthProvider staffId={staffId} year={year} month={month}>
              <div className="p-5">
                <MonthLockPanel />
              </div>
            </WorkMonthProvider>
          )}
        </div>
      </div>
    </div>
  );
}
