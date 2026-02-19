/**
 * 일정 페이지용 달력 — 클리닉 달력(ClinicCalendar)과 동일한 UI
 * 날짜 클릭 시 아래에 그날 상세 일정 표시 (부모에서 처리)
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

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelectable: boolean;
      dateStr: string;
      hasSession: boolean;
    }> = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const isPast = dateStr < today;
      days.push({
        date: new Date(cur),
        isCurrentMonth: cur.getMonth() === month,
        isToday: dateStr === today,
        isSelectable: cur.getMonth() === month && !isPast,
        dateStr,
        hasSession: datesWithSessions.includes(dateStr),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [currentMonth, datesWithSessions, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div
      className="stu-section stu-section--nested"
      style={{
        background: "var(--stu-surface)",
        borderRadius: "var(--stu-radius-md)",
        padding: "var(--stu-space-4)",
      }}
    >
      {/* 달력 헤더 — 클리닉과 동일 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--stu-space-4)",
        }}
      >
        <button
          type="button"
          className="stu-btn stu-btn--ghost stu-btn--sm"
          onClick={goToPreviousMonth}
          style={{ padding: "var(--stu-space-2)" }}
        >
          ←
        </button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{monthLabel}</div>
        <button
          type="button"
          className="stu-btn stu-btn--ghost stu-btn--sm"
          onClick={goToNextMonth}
          style={{ padding: "var(--stu-space-2)" }}
        >
          →
        </button>
      </div>

      {/* 요일 헤더 — 클리닉과 동일 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: "var(--stu-space-2)",
        }}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: day === "일" ? "var(--stu-danger)" : day === "토" ? "var(--stu-primary)" : "var(--stu-text-muted)",
              padding: "var(--stu-space-1)",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 — 클리닉과 동일 스타일 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate === day.dateStr;
          const isClickable = day.isSelectable;

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isClickable) onDateSelect(day.dateStr);
              }}
              disabled={!isClickable}
              style={{
                aspectRatio: "1",
                minHeight: 44,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--stu-radius)",
                border: isSelected
                  ? "2px solid var(--stu-primary)"
                  : day.isToday
                    ? "1px solid var(--stu-primary)"
                    : "1px solid transparent",
                background: isSelected
                  ? "var(--stu-primary-bg)"
                  : day.isCurrentMonth
                    ? "var(--stu-surface-soft)"
                    : "transparent",
                color: !day.isCurrentMonth
                  ? "var(--stu-text-muted)"
                  : isSelected
                    ? "var(--stu-primary)"
                    : "var(--stu-text)",
                fontWeight: day.isToday ? 700 : isSelected ? 600 : 400,
                fontSize: 14,
                cursor: isClickable ? "pointer" : "not-allowed",
                opacity: !day.isCurrentMonth ? 0.3 : day.isSelectable ? 1 : 0.5,
                transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                zIndex: 10,
                pointerEvents: isClickable ? "auto" : "none",
                touchAction: "manipulation",
              }}
              onMouseEnter={(e) => {
                if (isClickable) {
                  e.currentTarget.style.background = "var(--stu-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable) {
                  e.currentTarget.style.background = day.isCurrentMonth ? "var(--stu-surface-soft)" : "transparent";
                }
              }}
            >
              <span>{day.date.getDate()}</span>
              {day.hasSession && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: isSelected ? "var(--stu-primary)" : "var(--stu-text-muted)",
                    opacity: 0.8,
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
