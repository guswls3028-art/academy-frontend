import type {
  ClinicBookingRequest,
  ClinicSession,
} from "../api/clinicBooking.api";
import { isClinicSessionFull as isFull } from "@/shared/utils/clinicSessionCapacity";

type SelectionInput = {
  session: ClinicSession;
  changingBooking: boolean;
  activeBookedSessions: ClinicSession[];
  groupSessions: ClinicSession[];
  rangeStartSessionId: number | null;
  selectedSessionIds: number[];
  bookings: ClinicBookingRequest[];
};

type SelectionResult = {
  sessionIds: number[];
  rangeStartSessionId: number | null;
  notice: string | null;
};

export function resolveClinicSessionSelection({
  session,
  changingBooking,
  activeBookedSessions,
  groupSessions,
  rangeStartSessionId,
  selectedSessionIds,
  bookings,
}: SelectionInput): SelectionResult {
  if (changingBooking) {
    return { sessionIds: [session.id], rangeStartSessionId: session.id, notice: null };
  }

  const unchanged = (notice: string): SelectionResult => ({
    sessionIds: selectedSessionIds,
    rangeStartSessionId,
    notice,
  });
  const conflictsWithExistingPolicy = activeBookedSessions.some((activeSession) => (
    activeSession.id !== session.id
    && activeSession.date === session.date
    && (
      activeSession.allow_multi_slot_booking !== true
      || session.allow_multi_slot_booking !== true
    )
  ));
  if (conflictsWithExistingPolicy) {
    return unchanged("이미 한 타임 전용 예약이 있어 같은 날 다른 시간대를 함께 선택할 수 없어요.");
  }

  const anchorId = rangeStartSessionId ?? selectedSessionIds[0];
  const anchor = groupSessions.find((item) => item.id === anchorId);
  if (!anchor || anchor.date !== session.date) {
    return { sessionIds: [session.id], rangeStartSessionId: session.id, notice: null };
  }
  if (anchor.id === session.id) {
    return selectedSessionIds.length === 1
      ? { sessionIds: [], rangeStartSessionId: null, notice: null }
      : { sessionIds: [session.id], rangeStartSessionId: session.id, notice: null };
  }

  const anchorIndex = groupSessions.findIndex((item) => item.id === anchor.id);
  const endIndex = groupSessions.findIndex((item) => item.id === session.id);
  const range = groupSessions.slice(
    Math.min(anchorIndex, endIndex),
    Math.max(anchorIndex, endIndex) + 1,
  );
  if (range.some((item) => item.allow_multi_slot_booking !== true)) {
    return unchanged("한 타임 전용 일정이 포함되어 여러 시간대를 함께 선택할 수 없어요.");
  }
  if (range.some((item) => (
    isFull(item)
    || bookings.some((booking) => (
      booking.session === item.id
      && (booking.status === "pending" || booking.status === "booked")
    ))
  ))) {
    return unchanged("사이에 마감되었거나 이미 예약한 시간대가 있어 연속 선택할 수 없어요.");
  }
  const contiguous = range.every((item, index) => (
    index === 0 || range[index - 1].end_time?.slice(0, 5) === item.start_time.slice(0, 5)
  ));
  if (!contiguous) {
    return unchanged("시간 사이에 빈 구간이 있어 연속으로 선택할 수 없어요.");
  }
  return {
    sessionIds: range.map((item) => item.id),
    rangeStartSessionId: anchor.id,
    notice: null,
  };
}
