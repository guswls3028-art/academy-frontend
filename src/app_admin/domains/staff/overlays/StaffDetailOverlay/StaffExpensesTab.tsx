// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffExpensesTab.tsx
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import ExpensesPanel from "../../pages/OperationsPage/ExpensesPanel";

export default function StaffExpensesTab({
  staffId,
  year,
  month,
}: {
  staffId: number;
  year: number;
  month: number;
}) {
  return (
    <div className="max-w-[740px]">
      <WorkMonthProvider staffId={staffId} year={year} month={month}>
        <ExpensesPanel />
      </WorkMonthProvider>
    </div>
  );
}
