/**
 * 클리닉 예약 달력 컴포넌트
 * - 날짜 선택 가능
 * - 날짜별 정원 상태 색상: 초록=여유, 노랑=일부 참, 빨강=다 찼음 (dateCapacityStatus 기준)
 * - 내 예약 있으면 점 표시 (bookings)
 */
import { useState, useMemo } from "react";
import { formatYmd, todayYmd } from "@student/shared/utils/date";
import type { ClinicBookingRequest } from "@student/domains/clinic/api/clinicBooking.api";

/** 날짜별 정원 상태: 풀면(여유)=초록, 차면=노랑, 다차면=빨강 */
export type DateCapacityStatus = "green" | "yellow" | "red";

const CAPACITY_COLORS: Record<DateCapacityStatus, string> = {
  green: "#22c55e",
  yellow: "#fbbf24",
  red: "#ef4444",
};

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
      const isSelectable = isCurrentMonth && !isPast;

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
  }, [currentMonth, bookingByDate, availableDateSet, today]);

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDateStatusColor = (dateStr: string, booking?: ClinicBookingRequest) => {
    // 1) 정원 상태 우선: dateCapacityStatus가 있으면 해당 날짜 색상 사용
    const capacityStatus = dateCapacityStatus?.[dateStr];
    if (capacityStatus) return CAPACITY_COLORS[capacityStatus];
    // 2) 없으면 기존: 내 예약 상태로 색상 (하위 호환)
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
        padding: "var(--stu-space-3) var(--stu-space-2)",
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
          className="stu-icon-btn stu-icon-btn--primary"
          onClick={goToPreviousMonth}
          aria-label="이전 달"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em" }}>{monthLabel}</div>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
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
          gap: 2,
        }}
      >
      {calendarDays.map((day, idx) => {
        const isSelected = selectedDate === day.dateStr;
          const statusColor = getDateStatusColor(day.dateStr, day.booking);
          const isClickable = day.isSelectable;

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
              style={{
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
                  : day.isCurrentMonth
                    ? "1px solid var(--stu-border-subtle, rgba(0,0,0,0.05))"
                    : "1px solid transparent",
                background: statusColor
                  ? statusColor
                  : isSelected
                  ? "color-mix(in srgb, var(--stu-primary) 10%, transparent)"
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
                if (isClickable && !statusColor && !isSelected) {
                  e.currentTarget.style.background = "var(--stu-surface-soft)";
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable && !statusColor) {
                  e.currentTarget.style.background = isSelected
                    ? "color-mix(in srgb, var(--stu-primary) 10%, transparent)"
                    : "transparent";
                }
              }}
            >
              <span>{day.dayNum}</span>
              {/* 일정 있는 날짜 — 하단 dot 표시 */}
              {(day.isAvailable || day.booking) && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 3,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: day.booking
                      ? (statusColor ? "#fff" : "var(--stu-primary)")
                      : "var(--stu-primary)",
                    opacity: 0.9,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 범례: 정원 상태 (dateCapacityStatus 사용 시) */}
      {dateCapacityStatus && Object.keys(dateCapacityStatus).length > 0 ? (
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
            <div style={{ width: 16, height: 16, borderRadius: 4, background: CAPACITY_COLORS.green }} />
            <span className="stu-muted">정원 여유</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: CAPACITY_COLORS.yellow }} />
            <span className="stu-muted">일부 참</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: CAPACITY_COLORS.red }} />
            <span className="stu-muted">정원 마감</span>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
