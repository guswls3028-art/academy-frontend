// PATH: src/features/staff/pages/ReportsPage/ReportsPage.tsx
// 리포트/명세: 직원별·월별 집계, 엑셀/PDF 다운로드

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import PayrollHistoryTable from "./PayrollHistoryTable";
import WorkMonthLockHistory from "./WorkMonthLockHistory";
import { SectionHeader, EmptyState } from "@/shared/ui/ds";

function ymLabel(y: number, m: number) {
  return `${y}년 ${m}월`;
}

export default function ReportsPage() {
  const [params] = useSearchParams();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : undefined;
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="리포트/명세"
        description="직원별 급여 이력, 월별 마감 이력. 엑셀/PDF는 급여 스냅샷 탭에서 다운로드합니다."
      />

      <div className="grid grid-cols-[320px_1fr] gap-6">
        <div className="ds-panel-card">
          <div className="ds-panel-card__header px-4 py-3">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">직원 선택</div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              직원을 선택하면 해당 직원의 급여 이력을 볼 수 있습니다.
            </div>
          </div>
          <div className="p-3">
            <StaffOperationTable selectedStaffId={staffId} basePath="reports" />
          </div>
        </div>

        <div className="ds-panel-card min-h-[400px] space-y-6">
          <div className="ds-panel-card__header px-5 py-4 border-b border-[var(--color-border-divider)]">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">직원별 급여 이력</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {staffId ? "선택한 직원의 월별 확정 급여" : "좌측에서 직원을 선택하세요."}
            </div>
          </div>
          <div className="px-5 pb-5">
            {!staffId ? (
              <EmptyState
                scope="panel"
                tone="empty"
                title="직원이 선택되지 않았습니다."
                description="직원을 선택하면 급여 이력(월별 확정 내역)을 조회할 수 있습니다."
              />
            ) : (
              <PayrollHistoryTable staffId={staffId} />
            )}
          </div>

          <div className="border-t border-[var(--color-border-divider)] pt-4 px-5 pb-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">월별 마감 이력</div>
              <div className="flex items-center gap-2">
                <select
                  value={ym.year}
                  onChange={(e) => setYm((p) => ({ ...p, year: Number(e.target.value) }))}
                  className="ds-input h-9 min-w-[80px]"
                  aria-label="연도"
                >
                  {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  value={ym.month}
                  onChange={(e) => setYm((p) => ({ ...p, month: Number(e.target.value) }))}
                  className="ds-input h-9 min-w-[72px]"
                  aria-label="월"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>
            <WorkMonthLockHistory year={ym.year} month={ym.month} />
          </div>

          <div className="px-5 pb-5 text-[11px] text-[var(--color-text-muted)]">
            * 엑셀/PDF 다운로드는 <b>급여 스냅샷</b> 탭에서 기준월 선택 후 사용하세요.
          </div>
        </div>
      </div>
    </div>
  );
}
