// PATH: src/features/staff/pages/AttendancePage/AttendancePage.tsx
// Attendance tab content only. Layout (left list + header + tabs) is in StaffWorkspace.

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkMonthProvider } from "../../operations/context/WorkMonthContext";
import WorkRecordsPanel from "../OperationsPage/WorkRecordsPanel";
import { AttendanceCalendar } from "../../components/AttendanceCalendar";
import { PayrollSummaryCard } from "../../components/PayrollSummaryCard";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import type { WorkRecord } from "../../api/workRecords.api";

function getThisMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Selected-day detail block */
function DailyWorkDetailSection({
  selectedDate,
  records,
}: {
  selectedDate: string | null;
  records: WorkRecord[];
}) {
  const dayRecords = useMemo(() => {
    if (!selectedDate) return [];
    return records.filter((r) => r.date === selectedDate);
  }, [selectedDate, records]);

  if (!selectedDate) {
    return (
      <div className="staff-panel">
        <div className="staff-panel__header">
          <span className="staff-section-title">일자별 근무 상세</span>
        </div>
        <div className="staff-panel__body">
          <p className="staff-helper">캘린더에서 날짜를 선택하면 해당 일의 근무 내역이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const dayNum = selectedDate.slice(8);
  const dayLabel = `${selectedDate.slice(5, 7)}월 ${dayNum}일`;

  return (
    <div className="staff-panel">
      <div className="staff-panel__header">
        <span className="staff-section-title">{dayLabel} 근무 상세</span>
      </div>
      <div className="staff-panel__body">
        {dayRecords.length === 0 ? (
          <p className="staff-helper">해당 일자에 등록된 근무 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {dayRecords.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3"
              >
                <div className="staff-label mb-1">{r.work_type_name}</div>
                <div className="staff-body grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span>시작</span>
                  <span className="font-medium tabular-nums">{r.start_time}</span>
                  <span>종료</span>
                  <span className="font-medium tabular-nums">{r.end_time ?? "-"}</span>
                  <span>휴게(분)</span>
                  <span className="font-medium tabular-nums">{r.break_minutes ?? 0}</span>
                  <span>근무시간</span>
                  <span className="font-medium tabular-nums">{r.work_hours != null ? `${r.work_hours}h` : "-"}</span>
                  {r.amount != null && (
                    <>
                      <span>금액</span>
                      <span className="font-medium tabular-nums">{r.amount.toLocaleString()}원</span>
                    </>
                  )}
                </div>
                {r.memo && (
                  <p className="staff-helper mt-2 pt-2 border-t border-[var(--color-border-divider)]">메모: {r.memo}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceTabContent() {
  const { staffId, year, month, range } = useWorkMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { listQ } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });
  const records = listQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="staff-panel">
            <div className="staff-panel__header">
              <span className="staff-section-title">월별 근무 현황</span>
            </div>
            <div className="staff-panel__body">
              <AttendanceCalendar
                year={year}
                month={month}
                records={records}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>
          <DailyWorkDetailSection selectedDate={selectedDate} records={records} />
          <WorkRecordsPanel />
        </div>
        <div className="space-y-6">
          <PayrollSummaryCard />
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [params] = useSearchParams();
  const staffId = params.get("staffId") ? Number(params.get("staffId")) : null;
  const initialYm = useMemo(getThisMonth, []);
  const year = params.get("year") ? Number(params.get("year")) : initialYm.year;
  const month = params.get("month") ? Number(params.get("month")) : initialYm.month;

  if (staffId == null) return null;
  return (
    <WorkMonthProvider staffId={staffId} year={year} month={month}>
      <AttendanceTabContent />
    </WorkMonthProvider>
  );
}
