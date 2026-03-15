/**
 * 일정 페이지용 달력 — 클리닉 달력(ClinicCalendar)과 동일한 UI
 * 날짜 클릭 시 아래에 그날 상세 일정 표시 (부모에서 처리)
 * 날짜별 상태 색상: 예정/진행=파랑, 임박=빨강, 완료=회색
 */
import { useState, useMemo } from "react";

export type DateStatusColor = "action" | "danger" | "complete";

const STATUS_COLORS: Record<DateStatusColor, string> = {
  action: "var(--stu-primary, #3b82f6)",
  danger: "#ef4444",
  complete: "#94a3b8",
};

type Props = {
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  /** 일정이 있는 날짜 (YYYY-MM-DD). 있으면 셀에 점 표시 */
  datesWithSessions: string[];
  /** 날짜별 상태 색상 (예정=action, 임박=danger, 완료=complete) */
  dateStatusMap?: Record<string, DateStatusColor>;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function ScheduleCalendar({
  selectedDate,
  onDateSelect,
  datesWithSessions,
  dateStatusMap,
}: Props) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelectable: boolean;
      dateStr: string;
      hasSession: boolean;
      statusColor: string | null;
    }> = [];
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const isPast = dateStr < today;
      const statusKey = dateStatusMap?.[dateStr];
      days.push({
        dayNum: cur.getDate(),
        isCurrentMonth: cur.getMonth() === month,
        isToday: dateStr === today,
        isSelectable: cur.getMonth() === month,
        dateStr,
        hasSession: datesWithSessions.includes(dateStr),
        statusColor: statusKey ? STATUS_COLORS[statusKey] : null,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [currentMonth, datesWithSessions, dateStatusMap, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const hasStatusColors = dateStatusMap && Object.keys(dateStatusMap).length > 0;

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
          const sc = day.statusColor;

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
                background: sc
                  ? sc
                  : isSelected
                    ? "var(--stu-primary-bg)"
                    : day.isCurrentMonth
                      ? "var(--stu-surface-soft)"
                      : "transparent",
                color: sc
                  ? "#ffffff"
                  : !day.isCurrentMonth
                    ? "var(--stu-text-muted)"
                    : isSelected
                      ? "var(--stu-primary)"
                      : "var(--stu-text)",
                fontWeight: day.isToday ? 700 : isSelected ? 600 : 400,
                fontSize: 14,
                cursor: isClickable ? "pointer" : "default",
                opacity: !day.isCurrentMonth ? 0.3 : 1,
                transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                zIndex: 10,
                touchAction: "manipulation",
              }}
              onMouseEnter={(e) => {
                if (isClickable && !sc) {
                  e.currentTarget.style.background = "var(--stu-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable && !sc) {
                  e.currentTarget.style.background = isSelected
                    ? "var(--stu-primary-bg)"
                    : day.isCurrentMonth
                      ? "var(--stu-surface-soft)"
                      : "transparent";
                }
              }}
            >
              <span>{day.dayNum}</span>
              {day.hasSession && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: sc ? "#fff" : isSelected ? "var(--stu-primary)" : "var(--stu-text-muted)",
                    opacity: 0.8,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      {hasStatusColors && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--stu-space-4)",
            marginTop: "var(--stu-space-4)",
            paddingTop: "var(--stu-space-4)",
            borderTop: "1px solid var(--stu-border)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: STATUS_COLORS.action }} />
            <span className="stu-muted">예정</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: STATUS_COLORS.danger }} />
            <span className="stu-muted">임박</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: STATUS_COLORS.complete }} />
            <span className="stu-muted">완료</span>
          </div>
        </div>
      )}
    </div>
  );
}
