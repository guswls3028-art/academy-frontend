// PATH: src/features/staff/components/AttendanceCalendar.tsx
// Compact monthly calendar: cells show worked hours, click selects date

import { useMemo } from "react";
import type { WorkRecord } from "../api/workRecords.api";
import "../styles/staff-area.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  year: number;
  month: number;
  records: WorkRecord[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  /** true면 우측 패널용 작은 달력 */
  compact?: boolean;
};

export function AttendanceCalendar({
  year,
  month,
  records,
  selectedDate,
  onSelectDate,
  compact = false,
}: Props) {
  const { days, firstDay } = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    const first = new Date(year, month - 1, 1);
    const firstDay = first.getDay();
    const days: { date: string; day: number; hours: number }[] = [];
    for (let d = 1; d <= last; d++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayRecords = records.filter((r) => r.date === date);
      const hours = dayRecords.reduce((sum, r) => sum + (r.work_hours ?? 0), 0);
      days.push({ date, day: d, hours });
    }
    return { days, firstDay };
  }, [year, month, records]);

  const blanks = useMemo(() => Array(firstDay).fill(null), [firstDay]);
  const cells = [...blanks, ...days];

  return (
    <div className={`staff-area ${compact ? "staff-calendar-wrap staff-calendar-wrap--compact" : ""}`}>
      <div className={`staff-calendar ${compact ? "staff-calendar--compact" : ""}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="staff-calendar__head">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="staff-calendar__cell staff-calendar__cell--empty" />;
          }
          const { date, day, hours } = cell;
          const worked = hours > 0;
          const selected = selectedDate === date;
          return (
            <button
              key={date}
              type="button"
              className={`staff-calendar__cell ${
                selected ? "staff-calendar__cell--selected" : worked ? "staff-calendar__cell--worked" : ""
              }`}
              onClick={() => onSelectDate(date)}
            >
              <span className="day-num">{day}</span>
              {worked && <span className="hours">{hours}h</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
