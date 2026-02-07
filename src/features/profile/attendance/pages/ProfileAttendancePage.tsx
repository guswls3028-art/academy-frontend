// PATH: src/features/profile/attendance/pages/ProfileAttendancePage.tsx
import { useOutletContext } from "react-router-dom";
import { Section, EmptyState } from "@/shared/ui/ds";
import { ProfileOutletContext } from "../../layout/ProfileLayout";

import AttendanceHeader from "../components/AttendanceHeader";
import AttendanceSummaryCard from "../components/AttendanceSummaryCard";
import AttendanceChartCard from "../components/AttendanceChartCard";
import AttendanceTable from "../components/AttendanceTable";
import AttendanceFormModal from "../components/AttendanceFormModal";

import { useAttendanceDomain } from "../hooks/useAttendanceDomain";

export default function ProfileAttendancePage() {
  const {
    month,
    range,
    setRangeFrom,
    setRangeTo,
    resetRangeToMonth,
  } = useOutletContext<ProfileOutletContext>();

  const domain = useAttendanceDomain(month, range);

  const chartData = domain.rows.map((r) => ({
    date: r.date,
    hours: r.duration_hours,
  }));

  return (
    <>
      <AttendanceHeader
        range={range}
        setRangeFrom={setRangeFrom}
        setRangeTo={setRangeTo}
        resetRangeToMonth={resetRangeToMonth}
        rowsForExcel={domain.allRows}
        onCreate={domain.openCreate}
      />

      <Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttendanceSummaryCard summary={domain.rangeSummary} />
          <AttendanceChartCard data={chartData} />
        </div>
      </Section>

      <Section>
        {!domain.isLoading && domain.rows.length === 0 && (
          <EmptyState
            title="근태 기록 없음"
            description="선택한 기간에 근태 기록이 없습니다."
            action={
              <button
                onClick={domain.openCreate}
                className="mt-4 h-[38px] px-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] text-sm font-semibold text-white"
              >
                + 근태 등록
              </button>
            }
          />
        )}

        {domain.rows.length > 0 && (
          <AttendanceTable
            rows={domain.rows}
            onEdit={domain.openEdit}
            onDelete={domain.remove}
          />
        )}
      </Section>

      <AttendanceFormModal
        open={domain.open}
        initial={domain.editing}
        submitting={domain.submitting}
        onClose={domain.close}
        onSubmit={domain.submit}
      />
    </>
  );
}
