/**
 * 클리닉 예약 달력 컴포넌트
 * - 날짜 선택 가능
 * - 예약 상태별 색상 표시 (노란색: pending, 초록색: 승인)
 * - 여러 날짜 예약 가능
 */
import { useState, useMemo } from "react";
import { formatYmd } from "@/student/shared/utils/date";
import type { ClinicBookingRequest } from "@/student/domains/clinic/api/clinicBooking.api";

type Props = {
  selectedDate: string | null; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  bookings: ClinicBookingRequest[];
  availableDates: string[]; // YYYY-MM-DD 형식의 예약 가능한 날짜 목록
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
};

export default function ClinicCalendar({
  selectedDate,
  onDateSelect,
  bookings,
  availableDates,
  minDate,
  maxDate,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  // 날짜별 예약 상태 매핑
  const bookingByDate = useMemo(() => {
    const map = new Map<string, ClinicBookingRequest>();
    bookings.forEach((b) => {
      const date = b.session_date;
      // 같은 날짜에 여러 예약이 있으면 가장 최근 것만 표시
      if (!map.has(date) || new Date(b.created_at) > new Date(map.get(date)!.created_at)) {
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
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelectable: boolean;
      booking?: ClinicBookingRequest;
    }> = [];

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // 토요일까지

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10); // YYYY-MM-DD
      const isCurrentMonth = current.getMonth() === month;
      const isToday = dateStr === today;
      const booking = bookingByDate.get(dateStr);
      const isAvailable = availableDates.includes(dateStr);
      const isPast = dateStr < today;
      // 현재 월이고 과거가 아닌 날짜는 모두 선택 가능 (예약 가능 여부와 관계없이)
      const isSelectable = isCurrentMonth && !isPast;

      days.push({
        date: new Date(current),
        isCurrentMonth,
        isToday,
        isSelectable,
        booking,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth, bookingByDate, availableDates, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDateStatusColor = (booking?: ClinicBookingRequest) => {
    if (!booking) return null;
    if (booking.status === "booked" || booking.status === "approved") {
      return "#22c55e"; // 초록색 (승인됨)
    }
    if (booking.status === "pending") {
      return "#fbbf24"; // 노란색 (대기 중)
    }
    return null;
  };

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div
      className="stu-section stu-section--nested"
      style={{
        background: "var(--stu-surface)",
        borderRadius: "var(--stu-radius-md)",
        padding: "var(--stu-space-4)",
      }}
    >
      {/* 달력 헤더 */}
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

      {/* 요일 헤더 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: "var(--stu-space-2)",
        }}
      >
        {weekDays.map((day) => (
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

      {/* 달력 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
      {calendarDays.map((day, idx) => {
        const dateStr = day.date.toISOString().slice(0, 10); // YYYY-MM-DD
        const isSelected = selectedDate === dateStr;
          const statusColor = getDateStatusColor(day.booking);
          const isClickable = day.isSelectable;

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isClickable) {
                  onDateSelect(dateStr);
                }
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
                background: statusColor
                  ? statusColor
                  : isSelected
                  ? "var(--stu-primary-bg)"
                  : day.isCurrentMonth
                  ? "var(--stu-surface-soft)"
                  : "transparent",
                color: statusColor
                  ? "#ffffff"
                  : !day.isCurrentMonth
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
                if (isClickable && !statusColor) {
                  e.currentTarget.style.background = "var(--stu-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable && !statusColor) {
                  e.currentTarget.style.background = day.isCurrentMonth ? "var(--stu-surface-soft)" : "transparent";
                }
              }}
            >
              <span>{day.date.getDate()}</span>
              {day.booking && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: statusColor === "#22c55e" ? "#ffffff" : statusColor === "#fbbf24" ? "#ffffff" : "var(--stu-primary)",
                    opacity: 0.8,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
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
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#fbbf24" }} />
          <span className="stu-muted">승인 대기</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#22c55e" }} />
          <span className="stu-muted">승인됨</span>
        </div>
      </div>
    </div>
  );
}
