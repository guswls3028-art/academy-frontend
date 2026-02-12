// PATH: src/features/profile/attendance/pages/ProfileAttendancePage.tsx
import { useOutletContext } from "react-router-dom";
import { Button, EmptyState, Section } from "@/shared/ui/ds";
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
      <div className="flex flex-col gap-[var(--space-6)]">
        <AttendanceHeader
          range={range}
          setRangeFrom={setRangeFrom}
          setRangeTo={setRangeTo}
          resetRangeToMonth={resetRangeToMonth}
          rowsForExcel={domain.allRows}
          onCreate={domain.openCreate}
        />

        <Section>
          <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-2">
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
                <Button
                  intent="primary"
                  size="md"
                  onClick={domain.openCreate}
                  className="mt-4"
                >
                  + 근태 등록
                </Button>
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
      </div>

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
