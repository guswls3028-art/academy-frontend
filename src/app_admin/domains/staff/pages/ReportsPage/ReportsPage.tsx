// PATH: src/app_admin/domains/staff/pages/ReportsPage/ReportsPage.tsx
// Report/Statement tab: payroll history and lock history for selected staff. Section-style layout.

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
    <div className="staff-area space-y-6">
      <section className="staff-section-card">
        <div className="staff-section-card__header">
          <h2 className="staff-section-card__title">급여 이력</h2>
          <p className="staff-section-card__desc">선택한 직원의 월별 확정 급여 내역입니다.</p>
        </div>
        <div className="staff-section-card__body">
          <PayrollHistoryTable staffId={staffId} />
        </div>
      </section>

      <section className="staff-section-card">
        <div className="staff-section-card__header flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="staff-section-card__title">월별 마감 이력</h2>
            <p className="staff-section-card__desc">기준월 선택 시 해당 월 마감 상태를 확인합니다.</p>
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
        <div className="staff-section-card__body">
          <WorkMonthLockHistory year={ym.year} month={ym.month} />
        </div>
        <div className="staff-section-card__footer">
          엑셀/PDF 다운로드는 급여 스냅샷 탭에서 기준월 선택 후 사용하세요.
        </div>
      </section>
    </div>
  );
}
