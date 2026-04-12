// PATH: src/app_admin/domains/staff/pages/MonthLockPage/MonthLockPage.tsx
// Monthly closing tab content only. Layout is in StaffWorkspace.

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import MonthLockPanel from "../OperationsPage/MonthLockPanel";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function MonthLockPage() {
  const [params] = useSearchParams();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : null;
  const initialYm = useMemo(getThisMonth, []);
  const year = params.get("year") ? Number(params.get("year")) : initialYm.year;
  const month = params.get("month") ? Number(params.get("month")) : initialYm.month;

  if (staffId == null) return null;
  return (
    <WorkMonthProvider staffId={staffId} year={year} month={month}>
      <MonthLockPanel />
    </WorkMonthProvider>
  );
}
