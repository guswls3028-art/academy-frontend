// PATH: src/features/staff/pages/OperationsPage/OperationsPage.tsx
// Design: docs/DESIGN_SSOT.md 단일진실

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";

import StaffOperationTable from "./StaffOperationTable";
import MonthLockPanel from "./MonthLockPanel";
import WorkRecordsPanel from "./WorkRecordsPanel";
import ExpensesPanel from "./ExpensesPanel";
import { SectionHeader, EmptyState } from "@/shared/ui/ds";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getThisMonth() {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

export default function OperationsPage() {
  const [params] = useSearchParams();
  const staffId = Number(params.get("staffId"));

  const { year, month } = useMemo(getThisMonth, []);
  const monthText = useMemo(() => ymLabel(year, month), [year, month]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="작업"
        description={`${monthText} · 근무/비용 입력 및 월 마감(급여 확정) 처리. 합계/급여/시간/상태 판정은 백엔드 단일진실입니다.`}
      />

      <div className="grid grid-cols-[320px_1fr] gap-6">
        <div className="ds-panel-card">
          <div className="ds-panel-card__header px-4 py-3">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">직원 선택</div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              좌측에서 직원을 선택하면 우측 작업 콘솔이 활성화됩니다.
            </div>
          </div>

          <div className="p-3">
            <StaffOperationTable selectedStaffId={staffId} />
          </div>

          <div className="px-4 pb-4 pt-2 text-[11px] text-[var(--color-text-muted)]">
            * 직원 선택은 “선택” UI이며, 계산/추론이 아닙니다.
          </div>
        </div>

        <div className="ds-panel-card min-h-[520px]">
          <div className="ds-panel-card__header px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">작업 콘솔</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {staffId ? (
                    <>선택된 직원 기준으로 <b>{monthText}</b> 작업을 수행합니다.</>
                  ) : (
                    <>먼저 좌측에서 <b>직원</b>을 선택하세요.</>
                  )}
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {staffId ? <>직원 ID: <span className="font-semibold">{staffId}</span></> : <>상태: <span className="font-semibold">대기</span></>}
              </div>
            </div>
          </div>

          {!staffId ? (
            <div className="p-8">
              <EmptyState
                scope="panel"
                tone="empty"
                title="직원이 선택되지 않았습니다."
                description="좌측 직원 선택에서 직원을 클릭하면, 이 영역에 월 마감·근무 기록·비용 작업 패널이 활성화됩니다. 마감된 월은 생성/수정/삭제가 불가능합니다."
              />
            </div>
          ) : (
            <WorkMonthProvider staffId={staffId} year={year} month={month}>
              <div className="p-5 space-y-4">
                <MonthLockPanel />
                <WorkRecordsPanel />
                <ExpensesPanel />
              </div>
            </WorkMonthProvider>
          )}
        </div>
      </div>
    </div>
  );
}
