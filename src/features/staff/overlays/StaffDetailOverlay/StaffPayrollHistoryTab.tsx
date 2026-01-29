// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffPayrollHistoryTab.tsx
import PayrollHistoryTable from "../../pages/ReportsPage/PayrollHistoryTable";

export default function StaffPayrollHistoryTab() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">급여 히스토리</div>
        <div className="text-xs text-[var(--text-muted)]">
          * 급여는 <b>월 마감 시점 PayrollSnapshot</b> 기준이며 이후 수정 불가합니다.
        </div>
      </div>

      <PayrollHistoryTable />
    </div>
  );
}
