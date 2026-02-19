/**
 * 일정 페이지용 소형 달력
 * - 영역이 작으므로 요약만: 월·요일·날짜, 해당 날 일정 있으면 점 표시
 * - 날짜 클릭 시 아래에 그날 상세 일정 표시 (부모에서 처리)
 */
import { useState, useMemo } from "react";

type Props = {
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  /** 일정이 있는 날짜 (YYYY-MM-DD). 있으면 셀에 점 표시 */
  datesWithSessions: string[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function ScheduleCalendar({
  selectedDate,
  onDateSelect,
  datesWithSessions,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - last.getDay()));

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; dateStr: string; hasSession: boolean }> = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      days.push({
        date: new Date(cur),
        isCurrentMonth: cur.getMonth() === month,
        isToday: dateStr === today,
        dateStr,
        hasSession: datesWithSessions.includes(dateStr),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [currentMonth, datesWithSessions, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goPrev = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goNext = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  return (
    <div
      className="stu-section stu-section--nested"
      style={{
        padding: "var(--stu-space-3)",
        background: "var(--stu-surface)",
        borderRadius: "var(--stu-radius-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--stu-space-2)",
        }}
      >
        <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={goPrev} style={{ padding: "4px 8px" }}>
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{monthLabel}</span>
        <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={goNext} style={{ padding: "4px 8px" }}>
          →
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: "var(--stu-space-1)",
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              color: d === "일" ? "var(--stu-danger)" : d === "토" ? "var(--stu-primary)" : "var(--stu-text-muted)",
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate === day.dateStr;
          const isPast = day.dateStr < today;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDateSelect(day.dateStr)}
              style={{
                aspectRatio: "1",
                minHeight: 36,
                maxHeight: 44,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--stu-radius)",
                border: isSelected ? "2px solid var(--stu-primary)" : "1px solid transparent",
                background: isSelected ? "var(--stu-primary-bg)" : day.isCurrentMonth ? "var(--stu-surface-soft)" : "transparent",
                color: !day.isCurrentMonth ? "var(--stu-text-muted)" : isSelected ? "var(--stu-primary)" : "var(--stu-text)",
                fontWeight: day.isToday ? 700 : isSelected ? 600 : 400,
                fontSize: 12,
                cursor: "pointer",
                opacity: !day.isCurrentMonth ? 0.4 : isPast ? 0.7 : 1,
              }}
            >
              <span>{day.date.getDate()}</span>
              {day.hasSession && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: isSelected ? "var(--stu-primary)" : "var(--stu-text-muted)",
                    marginTop: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
