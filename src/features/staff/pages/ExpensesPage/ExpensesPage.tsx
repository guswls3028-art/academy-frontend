// PATH: src/features/staff/pages/ExpensesPage/ExpensesPage.tsx
// 비용/경비: 직원별 경비 청구(교통비, 재료비 등), 정산

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import ExpensesPanel from "../OperationsPage/ExpensesPanel";
import { SectionHeader, EmptyState } from "@/shared/ui/ds";

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
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="비용/경비"
        description={`${monthText} · 직원별 경비 청구(교통비, 재료비 등)를 입력·승인·반려합니다.`}
      />

      <div className="grid grid-cols-[320px_1fr] gap-6">
        <div className="ds-panel-card">
          <div className="ds-panel-card__header px-4 py-3">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">직원 선택</div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              좌측에서 직원을 선택하면 우측 비용 목록이 활성화됩니다.
            </div>
          </div>
          <div className="p-3">
            <StaffOperationTable selectedStaffId={staffId} basePath="expenses" />
          </div>
        </div>

        <div className="ds-panel-card min-h-[420px]">
          <div className="ds-panel-card__header px-5 py-4">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">비용 목록</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {staffId ? `${monthText} 기준` : "직원을 선택하세요."}
            </div>
          </div>
          {!staffId ? (
            <div className="p-8">
              <EmptyState
                scope="panel"
                tone="empty"
                title="직원이 선택되지 않았습니다."
                description="좌측에서 직원을 선택하면 비용을 조회·추가·승인할 수 있습니다."
              />
            </div>
          ) : (
            <WorkMonthProvider staffId={staffId} year={year} month={month}>
              <div className="p-5">
                <ExpensesPanel />
              </div>
            </WorkMonthProvider>
          )}
        </div>
      </div>
    </div>
  );
}
