// PATH: src/features/staff/pages/OperationsPage/OperationsPage.tsx
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";

import StaffOperationTable from "./StaffOperationTable";
import MonthLockPanel from "./MonthLockPanel";
import WorkRecordsPanel from "./WorkRecordsPanel";
import ExpensesPanel from "./ExpensesPanel";

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

  // ✅ UX: “직원 선택 전” 상태에서도 화면이 비지 않도록 콘솔 프레임 유지
  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold">작업</div>
          <div className="text-xs text-[var(--text-muted)]">
            {monthText} · 근무/비용 입력 및 월 마감(급여 확정) 처리
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          * 합계/급여/시간/상태 판정은 <b>백엔드 단일진실</b>입니다.
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* LEFT: Staff list (Sidebar) */}
        <div
          className={cx(
            "rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)]",
            "overflow-hidden"
          )}
        >
          <div className="px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
            <div className="text-sm font-semibold">직원 선택</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              좌측에서 직원을 선택하면 우측 작업 콘솔이 활성화됩니다.
            </div>
          </div>

          <div className="p-3">
            <StaffOperationTable selectedStaffId={staffId} />
          </div>

          <div className="px-4 pb-4 pt-2">
            <div className="text-[11px] text-[var(--text-muted)]">
              * 직원 선택은 “선택” UI이며, 계산/추론이 아닙니다.
            </div>
          </div>
        </div>

        {/* RIGHT: Operations Console */}
        <div
          className={cx(
            "rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)]",
            "min-h-[520px]"
          )}
        >
          <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">작업 콘솔</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {staffId ? (
                    <>
                      선택된 직원 기준으로 <b>{monthText}</b> 작업을 수행합니다.
                    </>
                  ) : (
                    <>
                      먼저 좌측에서 <b>직원</b>을 선택하세요.
                    </>
                  )}
                </div>
              </div>

              {staffId ? (
                <div className="text-xs text-[var(--text-muted)]">
                  직원 ID: <span className="font-semibold">{staffId}</span>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">
                  상태: <span className="font-semibold">대기</span>
                </div>
              )}
            </div>
          </div>

          {!staffId ? (
            <div className="p-10">
              <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-[var(--color-primary-soft)] border border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] flex items-center justify-center">
                    <span className="text-[var(--color-primary)] font-bold">!</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">
                      직원이 선택되지 않았습니다.
                    </div>
                    <div className="text-sm text-[var(--text-muted)] leading-relaxed">
                      좌측 <b>직원 선택</b>에서 직원을 클릭하면,
                      <br />
                      이 영역에 <b>월 마감</b>, <b>근무 기록</b>, <b>비용</b> 작업
                      패널이 활성화됩니다.
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      * 마감된 월은 생성/수정/삭제가 불가능합니다. (서버 규칙)
                    </div>
                  </div>
                </div>
              </div>
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
