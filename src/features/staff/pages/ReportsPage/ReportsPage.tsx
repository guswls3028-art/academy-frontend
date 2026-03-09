// PATH: src/features/staff/pages/ReportsPage/ReportsPage.tsx
// Report/Statement tab: payroll history and lock history for selected staff. Layout is in StaffWorkspace.

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PayrollHistoryTable from "./PayrollHistoryTable";
import WorkMonthLockHistory from "./WorkMonthLockHistory";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function ReportsPage() {
  const [params] = useSearchParams();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : null;
  const initialYm = useMemo(getThisMonth, []);
  const [ym, setYm] = useState({ year: initialYm.year, month: initialYm.month });

  if (staffId == null) return null;

  return (
    <div className="space-y-6">
      <div className="staff-panel">
        <div className="staff-panel__header">
          <span className="staff-section-title">급여 이력</span>
          <p className="staff-helper mt-1">선택한 직원의 월별 확정 급여 내역입니다.</p>
        </div>
        <div className="staff-panel__body">
          <PayrollHistoryTable staffId={staffId} />
        </div>
      </div>

      <div className="staff-panel">
        <div className="staff-panel__header flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="staff-section-title">월별 마감 이력</span>
            <p className="staff-helper mt-1">기준월 선택 시 해당 월 마감 상태를 확인합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ym.year}
              onChange={(e) => setYm((p) => ({ ...p, year: Number(e.target.value) }))}
              className="ds-input h-9 min-w-[80px] text-sm"
              aria-label="연도"
            >
              {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={ym.month}
              onChange={(e) => setYm((p) => ({ ...p, month: Number(e.target.value) }))}
              className="ds-input h-9 min-w-[72px] text-sm"
              aria-label="월"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
        <div className="staff-panel__body">
          <WorkMonthLockHistory year={ym.year} month={ym.month} />
        </div>
        <div className="staff-panel__body border-t border-[var(--color-border-divider)] pt-3">
          <p className="staff-helper">엑셀/PDF 다운로드는 급여 스냅샷 탭에서 기준월 선택 후 사용하세요.</p>
        </div>
      </div>
    </div>
  );
}
