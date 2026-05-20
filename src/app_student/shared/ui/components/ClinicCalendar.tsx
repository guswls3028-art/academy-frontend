/**
 * 클리닉 예약 달력 컴포넌트
 * - 날짜 선택 가능
 * - 날짜별 정원 상태 색상: 초록=여유, 노랑=일부 참, 빨강=다 찼음 (dateCapacityStatus 기준)
 * - 내 예약 있으면 점 표시 (bookings)
 */
import { useState, useMemo } from "react";
import { todayYmd } from "@student/shared/utils/date";
import type { ClinicBookingRequest } from "@student/domains/clinic/api/clinicBooking.api";
import styles from "./ClinicCalendar.module.css";

/** 날짜별 정원 상태: 풀면(여유)=초록, 차면=노랑, 다차면=빨강 */
export type DateCapacityStatus = "green" | "yellow" | "red";

type Props = {
  selectedDate: string | null; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  bookings: ClinicBookingRequest[];
  availableDates: string[]; // YYYY-MM-DD 형식의 예약 가능한 날짜 목록
  /** 날짜별 정원 상태 (스펙: 풀면 초록, 차면 노랑, 다차면 빨강). 있으면 셀 배경에 사용 */
  dateCapacityStatus?: Record<string, DateCapacityStatus>;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
};

export default function ClinicCalendar({
  selectedDate,
  onDateSelect,
  bookings,
  availableDates,
  dateCapacityStatus,
  minDate,
  maxDate,
}: Props) {
  const today = todayYmd();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  // availableDates를 Set으로 변환 (O(1) lookup)
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  // 날짜별 예약 상태 매핑 — 활성 예약(pending/booked/approved)을 우선 표시
  const bookingByDate = useMemo(() => {
    const map = new Map<string, ClinicBookingRequest>();
    const isActive = (s: string) => ["pending", "booked", "approved"].includes(s);
    // Sort: active bookings first, then by most recent
    const sorted = [...bookings].sort((a, b) => {
      const aPri = isActive(a.status) ? 0 : 1;
      const bPri = isActive(b.status) ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    sorted.forEach((b) => {
      const date = b.session_date;
      // First entry per date wins (highest priority due to sort)
      if (!map.has(date)) {
        map.set(date, b);
      }
    });
    return map;
  }, [bookings]);

  // 달력 그리드 생성
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작

    const days: Array<{
      dateStr: string; // YYYY-MM-DD
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelectable: boolean;
      isAvailable: boolean;
      booking?: ClinicBookingRequest;
    }> = [];

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // 토요일까지

    const current = new Date(startDate);
    while (current <= endDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const isCurrentMonth = current.getMonth() === month;
      const isToday = dateStr === today;
      const booking = bookingByDate.get(dateStr);
      const isAvailable = availableDateSet.has(dateStr);
      const isPast = dateStr < today;
      const isBeforeMin = minDate ? dateStr < minDate : false;
      const isAfterMax = maxDate ? dateStr > maxDate : false;
      const isSelectable = isCurrentMonth && !isPast && !isBeforeMin && !isAfterMax;

      days.push({
        dateStr,
        dayNum: current.getDate(),
        isCurrentMonth,
        isToday,
        isSelectable,
        isAvailable,
        booking,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth, bookingByDate, availableDateSet, today, minDate, maxDate]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDateStatus = (dateStr: string, booking?: ClinicBookingRequest): DateCapacityStatus | "booked" | "pending" | null => {
    // 1) 정원 상태 우선: dateCapacityStatus가 있으면 해당 날짜 색상 사용
    const capacityStatus = dateCapacityStatus?.[dateStr];
    if (capacityStatus) return capacityStatus;
    // 2) 없으면 기존: 내 예약 상태로 색상 (하위 호환)
    if (!booking) return null;
    if (booking.status === "booked" || booking.status === "approved") {
      return "booked";
    }
    if (booking.status === "pending") {
      return "pending";
    }
    return null;
  };

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className={`stu-section stu-section--nested ${styles.calendar}`}>
      {/* 달력 헤더 */}
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

      {/* 요일 헤더 */}
      <div className={styles.weekdays}>
        {weekDays.map((day) => (
          <div
            key={day}
            className={`${styles.weekday} ${day === "일" ? styles.sunday : ""} ${day === "토" ? styles.saturday : ""}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className={styles.dayGrid}>
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate === day.dateStr;
          const status = getDateStatus(day.dateStr, day.booking);
          const isClickable = day.isSelectable;
          const dayClassName = [
            styles.dayButton,
            isClickable ? styles.clickable : styles.disabled,
            day.isCurrentMonth ? styles.currentMonth : styles.outsideMonth,
            day.isToday ? styles.today : "",
            isSelected ? styles.selected : "",
            status ? statusClassName(status) : "",
          ].filter(Boolean).join(" ");
          const dotClassName = [
            styles.eventDot,
            status ? styles.dotOnStatus : styles.dotAvailable,
          ].filter(Boolean).join(" ");

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isClickable) {
                  onDateSelect(day.dateStr);
                }
              }}
              disabled={!isClickable}
              className={dayClassName}
            >
              <span>{day.dayNum}</span>
              {/* 일정 있는 날짜 — 하단 dot 표시 */}
              {(day.isAvailable || day.booking) && <span className={dotClassName} />}
            </button>
          );
        })}
      </div>

      {/* 범례: 정원 상태 (dateCapacityStatus 사용 시) */}
      {dateCapacityStatus && Object.keys(dateCapacityStatus).length > 0 ? (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchGreen}`} />
            <span className="stu-muted">정원 여유</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchYellow}`} />
            <span className="stu-muted">일부 참</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchRed}`} />
            <span className="stu-muted">정원 마감</span>
          </div>
        </div>
      ) : (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchYellow}`} />
            <span className="stu-muted">승인 대기</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.swatch} ${styles.swatchGreen}`} />
            <span className="stu-muted">승인됨</span>
          </div>
        </div>
      )}
    </div>
  );
}

function statusClassName(status: DateCapacityStatus | "booked" | "pending"): string {
  if (status === "red") return styles.statusRed;
  if (status === "yellow" || status === "pending") return styles.statusYellow;
  return styles.statusGreen;
}
