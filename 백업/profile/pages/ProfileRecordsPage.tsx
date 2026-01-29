// PATH: src/features/profile/pages/ProfileRecordsPage.tsx
import { useOutletContext } from "react-router-dom";
import { ProfileOutletContext } from "../layout/ProfileLayout";

import { useAttendanceDomain } from "../attendance/hooks/useAttendanceDomain";
import AttendanceHeader from "../attendance/components/AttendanceHeader";
import AttendanceSummary from "../attendance/components/AttendanceSummary";
import AttendanceList from "../attendance/components/AttendanceList";
import AttendanceModals from "../attendance/components/AttendanceModals";

export default function ProfileRecordsPage() {
  const { month, setMonth } =
    useOutletContext<ProfileOutletContext>();

  const domain = useAttendanceDomain(month);

  return (
    <>
      <AttendanceHeader
        month={month}
        setMonth={setMonth}
        rows={domain.rows}
      />

      <AttendanceSummary summary={domain.summary} />

      <AttendanceList
        rows={domain.rows}
        isLoading={domain.isLoading}
        onCreate={domain.openCreate}
        onEdit={domain.openEdit}
        onDelete={domain.remove}
      />

      <AttendanceModals
        open={domain.open}
        editing={domain.editing}
        submitting={domain.submitting}
        onClose={domain.closeModal}
        onSubmit={domain.submit}
      />
    </>
  );
}
