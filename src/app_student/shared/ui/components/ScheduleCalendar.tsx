/**
 * 일정 페이지용 달력 — 클리닉 달력(ClinicCalendar)과 동일한 UI
 * 날짜 클릭 시 아래에 그날 상세 일정 표시 (부모에서 처리)
 * 날짜별 상태 색상: 예정/진행=파랑, 임박=빨강, 완료=회색
 */
import { useState, useMemo } from "react";
import styles from "./ScheduleCalendar.module.css";

export type DateStatusColor = "action" | "danger" | "complete";

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
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const sessionsSet = useMemo(() => new Set(datesWithSessions), [datesWithSessions]);
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
      statusKey: DateStatusColor | null;
    }> = [];
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const statusKey = dateStatusMap?.[dateStr];
      days.push({
        dayNum: cur.getDate(),
        isCurrentMonth: cur.getMonth() === month,
        isToday: dateStr === today,
        isSelectable: cur.getMonth() === month,
        dateStr,
        hasSession: sessionsSet.has(dateStr),
        statusKey: statusKey ?? null,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [currentMonth, sessionsSet, dateStatusMap, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const hasStatusColors = dateStatusMap && Object.keys(dateStatusMap).length > 0;

  return (
    <div className={`stu-section stu-section--nested ${styles.calendar}`}>
      {/* 달력 헤더 — primary 원형 아이콘 버튼 */}
      <div className={styles.header}>
        <button
          type="button"
          className="stu-icon-btn stu-icon-btn--primary"
          onClick={goToPreviousMonth}
          aria-label="이전 달"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.monthLabel}>{monthLabel}</div>
        <button
          type="button"
          className="stu-icon-btn stu-icon-btn--primary"
          onClick={goToNextMonth}
          aria-label="다음 달"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 — 클리닉과 동일 */}
      <div className={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={`${styles.weekday} ${day === "일" ? styles.sunday : ""} ${day === "토" ? styles.saturday : ""}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 — 클리닉과 동일 스타일 */}
      <div className={styles.dayGrid}>
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate === day.dateStr;
          const isClickable = day.isSelectable;
          const statusKey = day.statusKey;
          const dayClassName = [
            styles.dayButton,
            isClickable ? styles.clickable : styles.disabled,
            day.isCurrentMonth ? styles.currentMonth : styles.outsideMonth,
            day.isToday ? styles.today : "",
            isSelected ? styles.selected : "",
            statusKey ? statusClassName(statusKey) : "",
          ].filter(Boolean).join(" ");
          const dotClassName = [
            styles.sessionDot,
            statusKey ? styles.dotOnStatus : "",
            !statusKey && isSelected ? styles.dotSelected : "",
          ].filter(Boolean).join(" ");

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
              className={dayClassName}
            >
              <span>{day.dayNum}</span>
              {day.hasSession && <span className={dotClassName} />}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      {hasStatusColors && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchAction}`} />
            <span className="stu-muted">예정</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchDanger}`} />
            <span className="stu-muted">임박</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchComplete}`} />
            <span className="stu-muted">완료</span>
          </div>
        </div>
      )}
    </div>
  );
}

function statusClassName(status: DateStatusColor): string {
  if (status === "danger") return styles.statusDanger;
  if (status === "complete") return styles.statusComplete;
  return styles.statusAction;
}
