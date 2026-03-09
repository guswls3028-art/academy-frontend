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

/** 선택날짜 근무상세 — 섹션 카드 */
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
      <section className="staff-area staff-section-card">
        <div className="staff-section-card__header">
          <h2 className="staff-section-card__title">선택 날짜 근무 상세</h2>
        </div>
        <div className="staff-section-card__body">
          <p className="staff-helper">달력에서 날짜를 선택하세요.</p>
        </div>
      </section>
    );
  }

  const dayNum = selectedDate.slice(8);
  const dayLabel = `${selectedDate.slice(5, 7)}월 ${dayNum}일`;

  return (
    <section className="staff-area staff-section-card">
      <div className="staff-section-card__header">
        <h2 className="staff-section-card__title">{dayLabel} 근무 상세</h2>
      </div>
      <div className="staff-section-card__body">
        {dayRecords.length === 0 ? (
          <p className="staff-helper">해당 날짜에 근무 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {dayRecords.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-border-divider)_6%,var(--color-bg-surface))] px-4 py-3"
              >
                <div className="staff-label mb-1">{r.work_type_name}</div>
                <div className="staff-body grid grid-cols-2 gap-x-4 gap-y-1">
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
    </section>
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
    <div className="staff-area flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 중앙: 선택날짜 근무상세 + 월 전체 근무기록 */}
        <div className="lg:col-span-2 space-y-6">
          <DailyWorkDetailSection selectedDate={selectedDate} records={records} />
          <WorkRecordsPanel />
        </div>
        {/* 3번째 패널: 달력 + 요약 */}
        <div className="space-y-6">
          <section className="staff-section-card">
            <div className="staff-section-card__header">
              <h2 className="staff-section-card__title">달력</h2>
              <p className="staff-section-card__desc">{year}년 {month}월</p>
            </div>
            <div className="staff-section-card__body flex justify-center">
              <AttendanceCalendar
                year={year}
                month={month}
                records={records}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                compact
              />
            </div>
          </section>
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
