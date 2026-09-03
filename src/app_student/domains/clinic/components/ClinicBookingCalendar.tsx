import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ClinicBookingRequest,
  ClinicSession,
} from "../api/clinicBooking.api";
import { CLINIC_WEEKDAYS, clinicDateParts } from "../clinicDate";
import { isClinicSessionFull as isFull } from "@/shared/utils/clinicSessionCapacity";
import styles from "./ClinicBookingCalendar.module.css";

type Props = {
  sessions: ClinicSession[];
  bookings: ClinicBookingRequest[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
};

function parseYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toYmdLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function ClinicBookingCalendar({
  sessions,
  bookings,
  selectedDate,
  onDateSelect,
}: Props) {
  const initialDate = selectedDate ?? sessions[0]?.date;
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = initialDate ? parseYmd(initialDate) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [focusedDate, setFocusedDate] = useState<string | null>(selectedDate);
  const dayButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const today = toYmdLocal(new Date());

  useEffect(() => {
    if (!selectedDate) return;
    setFocusedDate(selectedDate);
    const date = parseYmd(selectedDate);
    setVisibleMonth((current) => (
      current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth()
        ? current
        : new Date(date.getFullYear(), date.getMonth(), 1)
    ));
  }, [selectedDate]);

  const sessionsByDate = useMemo(() => {
    const groups = new Map<string, ClinicSession[]>();
    sessions.forEach((session) => {
      groups.set(session.date, [...(groups.get(session.date) ?? []), session]);
    });
    return groups;
  }, [sessions]);
  const bookingCountByDate = useMemo(
    () => bookings.reduce((counts, booking) => {
      if (booking.status !== "pending" && booking.status !== "booked") return counts;
      counts.set(booking.session_date, (counts.get(booking.session_date) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    [bookings],
  );
  const days = useMemo(() => {
    const start = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1 - visibleMonth.getDay(),
    );
    return Array.from({ length: 42 }, (_value, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return {
        date: toYmdLocal(date),
        day: date.getDate(),
        weekdayIndex: date.getDay(),
        currentMonth: date.getMonth() === visibleMonth.getMonth(),
      };
    });
  }, [visibleMonth]);

  useEffect(() => {
    setFocusedDate((current) => (
      current && days.some((day) => day.date === current)
        ? current
        : toYmdLocal(visibleMonth)
    ));
  }, [days, visibleMonth]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const moveDayFocus = (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= days.length) return;
    setFocusedDate(days[nextIndex].date);
    dayButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <section className={styles.calendar} aria-label="클리닉 날짜 선택">
      <header className={styles.header}>
        <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
          이전
        </button>
        <strong aria-live="polite">
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
          다음
        </button>
      </header>
      <div className={styles.grid} role="grid" aria-label="클리닉 월간 일정">
        {CLINIC_WEEKDAYS.map((weekday) => (
          <div key={weekday} className={styles.weekday} role="columnheader">
            {weekday}
          </div>
        ))}
        {days.map((day, index) => {
          const dateSessions = sessionsByDate.get(day.date) ?? [];
          const hasOpen = dateSessions.some((session) => !isFull(session));
          const bookingCount = bookingCountByDate.get(day.date) ?? 0;
          const hasBooked = bookingCount > 0;
          const hasFull = dateSessions.some(isFull);
          const selectable = dateSessions.length > 0 || hasBooked;
          const isToday = day.date === today;
          const markers = [
            hasOpen ? "예약 가능" : null,
            hasBooked ? "예약 있음" : null,
            hasFull ? "마감" : null,
          ].filter(Boolean);
          return (
            <div
              key={day.date}
              role="gridcell"
              data-weekday-index={day.weekdayIndex}
              className={styles.cell}
            >
              <button
                ref={(element) => { dayButtonRefs.current[index] = element; }}
                type="button"
                data-testid={`clinic-calendar-day-${day.date}`}
                data-open={hasOpen ? "true" : "false"}
                data-booked={hasBooked ? "true" : "false"}
                data-booked-count={bookingCount}
                data-full={hasFull ? "true" : "false"}
                data-today={isToday ? "true" : "false"}
                aria-label={`${clinicDateParts(day.date).ariaLabel}${markers.length ? `, ${markers.join(", ")}` : ""}`}
                aria-pressed={selectedDate === day.date}
                aria-current={isToday ? "date" : undefined}
                aria-disabled={!selectable}
                tabIndex={(focusedDate ?? selectedDate ?? days[0].date) === day.date ? 0 : -1}
                className={[
                  styles.day,
                  !selectable ? styles.disabled : "",
                  !day.currentMonth ? styles.outside : "",
                  isToday ? styles.today : "",
                  selectedDate === day.date ? styles.selected : "",
                ].filter(Boolean).join(" ")}
                onFocus={() => setFocusedDate(day.date)}
                onClick={() => { if (selectable) onDateSelect(day.date); }}
                onKeyDown={(event) => {
                  const offsets: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  const offset = offsets[event.key];
                  if (offset == null) return;
                  event.preventDefault();
                  moveDayFocus(index, offset);
                }}
              >
                <span className={styles.dayNumber}>{day.day}</span>
                <span className={styles.markers} aria-hidden="true">
                  {hasOpen && <span className={`${styles.marker} ${styles.open}`} />}
                  {hasBooked && (
                    <span className={styles.bookingCount}>{bookingCount}</span>
                  )}
                  {hasFull && <span className={`${styles.marker} ${styles.full}`} />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.legend} aria-label="달력 표시 안내">
        <span><i className={`${styles.marker} ${styles.open}`} />예약 가능</span>
        <span><i className={styles.bookingCount}>1</i>내 예약</span>
        <span><i className={`${styles.marker} ${styles.full}`} />마감</span>
      </div>
    </section>
  );
}
