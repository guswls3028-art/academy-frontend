// PATH: src/app_admin/domains/profile/attendance/pages/ProfileAttendancePage.tsx
import { useOutletContext } from "react-router";
import { Button, EmptyState, Section } from "@/shared/ui/ds";
import { ProfileOutletContext } from "../../ProfileLayout";

import AttendanceHeader from "../components/AttendanceHeader";
import AttendanceSummaryCard from "../components/AttendanceSummaryCard";
import AttendanceChartCard from "../components/AttendanceChartCard";
import AttendanceTable from "../components/AttendanceTable";

import { useAttendanceDomain } from "../hooks/useAttendanceDomain";

export default function ProfileAttendancePage() {
  const {
    month,
    range,
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
          resetRangeToMonth={resetRangeToMonth}
          rowsForExcel={domain.allRows}
        />

        <Section>
          <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-2">
            <AttendanceSummaryCard summary={domain.rangeSummary} />
            <AttendanceChartCard data={chartData} />
          </div>
        </Section>

        <Section>
          {domain.isError && (
            <EmptyState
              tone="error"
              title="근무 기록을 불러오지 못했습니다"
              description="연결 상태를 확인한 뒤 다시 시도해 주세요."
              actions={
                <Button intent="secondary" size="sm" onClick={() => void domain.refetch()}>
                  다시 시도
                </Button>
              }
            />
          )}

          {!domain.isError && !domain.isLoading && !domain.hasStaffProfile && (
            <EmptyState
              title="연결된 직원 정보가 없습니다"
              description="관리자에게 직원 계정 연결을 요청해 주세요."
            />
          )}

          {!domain.isError && !domain.isLoading && domain.hasStaffProfile && domain.rows.length === 0 && (
            <EmptyState
              title="근무 기록 없음"
              description="로그인 후 근무 유형을 선택해 출근하면 이곳에 기록됩니다."
            />
          )}

          {domain.rows.length > 0 && (
            <AttendanceTable rows={domain.rows} />
          )}
        </Section>
      </div>
    </>
  );
}
