// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.tsx
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import WorkRecordsPanel from "../../pages/OperationsPage/WorkRecordsPanel";

export default function StaffWorkRecordsTab({
  staffId,
  year,
  month,
}: {
  staffId: number;
  year: number;
  month: number;
}) {
  return (
    <div className="max-w-[720px]">
      <WorkMonthProvider staffId={staffId} year={year} month={month}>
        <WorkRecordsPanel />
      </WorkMonthProvider>
    </div>
  );
}
