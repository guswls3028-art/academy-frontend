import dayjs from "dayjs";

export const INVALID_CLINIC_RANGE_MESSAGE = "시작과 종료는 달라야 합니다. 24시간 미만의 운영 시간을 선택해 주세요.";

export function isInvalidClinicRange(startTime: string, endTime: string): boolean {
  return Boolean(startTime && endTime && startTime.slice(0, 5) === endTime.slice(0, 5));
}

/** Times are anchored to the operating session, not the viewer's current date. */
export function clinicTimeLabel(time: string, operatingStart: string, date?: string | null, operatingDate?: string | null): string {
  const clock = time.slice(0, 5);
  if (date && operatingDate && date !== operatingDate) return `${date} ${clock}`;
  return clock < operatingStart.slice(0, 5) ? `익일 ${clock}` : clock;
}

export function clinicBookingRangeText(booking: {
  session_date?: string | null;
  session_start_time?: string | null;
  booking_start_time?: string | null;
  booking_end_time?: string | null;
  booking_start_date?: string | null;
  booking_end_date?: string | null;
}): string {
  const start = booking.booking_start_time ?? "";
  const end = booking.booking_end_time ?? "";
  const anchor = booking.session_start_time ?? start;
  const endLabel = booking.booking_start_date && booking.booking_start_date === booking.booking_end_date
    ? end.slice(0, 5)
    : clinicTimeLabel(end, anchor, booking.booking_end_date, booking.session_date);
  return `${clinicTimeLabel(start, anchor, booking.booking_start_date, booking.session_date)}–${endLabel}`;
}

/** Only widens discovery for an unfinished previous operating date. Today's policy is unchanged. */
export function isOngoingPreviousClinic(session: {
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  end_date?: string | null;
  duration_minutes?: number | null;
}, now = dayjs()): boolean {
  if (!session.date || !session.start_time || session.date !== now.subtract(1, "day").format("YYYY-MM-DD")) return false;
  const start = dayjs(`${session.date}T${session.start_time}`);
  const end = session.end_time
    ? dayjs(`${session.end_date ?? (session.end_time < session.start_time ? start.add(1, "day").format("YYYY-MM-DD") : session.date)}T${session.end_time}`)
    : start.add(session.duration_minutes ?? 0, "minute");
  return end.isValid() && now.isBefore(end);
}

/** A saved reservation remains visible independently of current discovery eligibility. */
export function isOngoingPreviousBooking(booking: {
  session_date: string;
  session_start_time: string;
  session_end_time?: string | null;
  session_duration_minutes?: number | null;
  booking_end_date?: string | null;
  booking_end_time?: string | null;
}, now = dayjs()): boolean {
  if (booking.session_date !== now.subtract(1, "day").format("YYYY-MM-DD")) return false;
  if (booking.booking_end_date && booking.booking_end_time) {
    return now.isBefore(dayjs(`${booking.booking_end_date}T${booking.booking_end_time}`));
  }
  return isOngoingPreviousClinic({ date: booking.session_date, start_time: booking.session_start_time, end_time: booking.session_end_time, duration_minutes: booking.session_duration_minutes }, now);
}
