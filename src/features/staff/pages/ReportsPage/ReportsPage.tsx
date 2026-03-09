// PATH: src/features/staff/pages/ReportsPage/ReportsPage.tsx
// 리포트/명세: 직원별·월별 집계, 급여 이력, 마감 이력

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StaffOperationTable from "../OperationsPage/StaffOperationTable";
import PayrollHistoryTable from "./PayrollHistoryTable";
import WorkMonthLockHistory from "./WorkMonthLockHistory";
import { EmptyState } from "@/shared/ui/ds";
import "../../styles/staff-area.css";

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
    <div className="staff-area grid grid-cols-[320px_1fr] gap-6 min-h-0">
      <div className="staff-panel flex flex-col min-h-0">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원 선택</div>
          <p className="staff-helper mt-1">선택한 직원의 급여 이력·명세를 조회합니다.</p>
        </div>
        <div className="staff-panel__body overflow-y-auto min-h-0">
          <StaffOperationTable selectedStaffId={staffId} basePath="reports" />
        </div>
      </div>

      <div className="staff-panel min-h-[400px] flex flex-col overflow-hidden">
        <div className="staff-panel__header">
          <div className="staff-page-title">직원별 급여 이력</div>
          <p className="staff-helper mt-1">{staffId ? "선택한 직원의 월별 확정 급여" : "좌측에서 직원을 선택하세요."}</p>
        </div>
        <div className="staff-panel__body overflow-y-auto flex-1">
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

        <div className="staff-panel__header border-t border-[var(--color-border-divider)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="staff-section-title">월별 마감 이력</div>
              <p className="staff-helper mt-1">기준월 선택 시 해당 월 마감 상태를 확인합니다.</p>
            </div>
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
        </div>
        <div className="staff-panel__body">
          <WorkMonthLockHistory year={ym.year} month={ym.month} />
        </div>
        <div className="staff-panel__body border-t border-[var(--color-border-divider)]">
          <p className="staff-helper">* 엑셀/PDF 다운로드는 <strong>급여 스냅샷</strong> 탭에서 기준월 선택 후 사용하세요.</p>
        </div>
      </div>
    </div>
  );
}
