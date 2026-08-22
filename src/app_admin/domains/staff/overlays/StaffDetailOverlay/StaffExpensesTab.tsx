// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffExpensesTab.tsx
import { useMemo } from "react";

import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import ExpensesPanel from "../../pages/OperationsPage/ExpensesPanel";

function getThisMonth() {
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export default function StaffExpensesTab({ staffId }: { staffId: number }) {
  const { year, month } = useMemo(getThisMonth, []);

  return (
    <div className="max-w-[740px]">
      <WorkMonthProvider staffId={staffId} year={year} month={month}>
        <ExpensesPanel />
      </WorkMonthProvider>
    </div>
  );
}
