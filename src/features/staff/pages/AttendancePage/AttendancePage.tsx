// PATH: src/features/staff/pages/AttendancePage/AttendancePage.tsx
// 근태 탭 — KPI 배너 상단 + 캘린더/상세 하단

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

/** 선택날짜 근무상세 */
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
          <p className="staff-helper">달력에서 날짜를 선택하면 해당 날의 근무 상세가 표시됩니다.</p>
        </div>
      </section>
    );
  }

  const dayLabel = `${selectedDate.slice(5, 7)}월 ${selectedDate.slice(8)}일`;
  const totalHours = dayRecords.reduce((s, r) => s + (Number(r.work_hours) || 0), 0);
  const totalAmount = dayRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <section className="staff-area staff-section-card">
      <div className="staff-section-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="staff-section-card__title">{dayLabel} 근무 상세</h2>
        {dayRecords.length > 0 && (
          <div style={{ display: "flex", gap: 12, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: "var(--color-primary)" }}>{totalHours.toFixed(1)}h</span>
            <span style={{ color: "var(--color-text-primary)" }}>{totalAmount.toLocaleString()}원</span>
          </div>
        )}
      </div>
      <div className="staff-section-card__body">
        {dayRecords.length === 0 ? (
          <p className="staff-helper">해당 날짜에 근무 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {dayRecords.map((r) => {
              let pctStart = 0;
              let pctWidth = 0;
              try {
                const sp = (r.start_time ?? "").split(":");
                const ep = (r.end_time ?? "").split(":");
                const startMin = sp.length >= 2 ? parseInt(sp[0]) * 60 + parseInt(sp[1]) : 0;
                const endMin = ep.length >= 2 ? parseInt(ep[0]) * 60 + parseInt(ep[1]) : startMin;
                if (!isNaN(startMin) && !isNaN(endMin)) {
                  pctStart = Math.max(0, Math.min(100, ((startMin - 360) / 1080) * 100));
                  pctWidth = Math.max(2, Math.min(100 - pctStart, ((endMin - startMin) / 1080) * 100));
                }
              } catch { /* 파싱 실패 시 바 미표시 */ }

              return (
                <div
                  key={r.id}
                  style={{
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--color-border-divider)",
                    background: "color-mix(in srgb, var(--color-border-divider) 6%, var(--color-bg-surface))",
                    padding: "12px 16px",
                    overflow: "hidden",
                  }}
                >
                  {/* 시간 바 (시각적 타임라인) */}
                  <div style={{ height: 6, borderRadius: 3, background: "var(--color-bg-surface-soft)", marginBottom: 10, position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: `${pctStart}%`,
                        width: `${pctWidth}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: "var(--color-primary)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{r.work_type_name}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>
                      {r.work_hours != null ? `${r.work_hours}h` : "-"}
                      {r.amount != null && <span style={{ color: "var(--color-text-secondary)", marginLeft: 8 }}>{r.amount.toLocaleString()}원</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-text-muted)" }}>
                    <span>{r.start_time?.slice(0, 5)} ~ {r.end_time?.slice(0, 5) ?? "진행 중"}</span>
                    {(r.break_minutes ?? 0) > 0 && <span>휴게 {r.break_minutes}분</span>}
                  </div>
                  {r.memo && (
                    <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--color-border-divider)" }}>
                      {r.memo}
                    </p>
                  )}
                </div>
              );
            })}
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
      {/* ① 최상단: 급여 KPI 배너 */}
      <PayrollSummaryCard />

      {/* ② 캘린더 + 일별 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌: 캘린더 */}
        <div>
          <section className="staff-section-card">
            <div className="staff-section-card__header">
              <h2 className="staff-section-card__title">{year}년 {month}월</h2>
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
        </div>

        {/* 우: 선택 날짜 상세 */}
        <div className="lg:col-span-2">
          <DailyWorkDetailSection selectedDate={selectedDate} records={records} />
        </div>
      </div>

      {/* ③ 월 전체 근무기록 */}
      <WorkRecordsPanel />
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
