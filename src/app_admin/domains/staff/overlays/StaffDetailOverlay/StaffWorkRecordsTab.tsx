// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.tsx
import { useMemo } from "react";

import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import WorkRecordsPanel from "../../pages/OperationsPage/WorkRecordsPanel";

function getThisMonth() {
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export default function StaffWorkRecordsTab({ staffId }: { staffId: number }) {
  const { year, month } = useMemo(getThisMonth, []);

  return (
    <div className="max-w-[720px]">
      <WorkMonthProvider staffId={staffId} year={year} month={month}>
        <WorkRecordsPanel />
      </WorkMonthProvider>
    </div>
  );
}
