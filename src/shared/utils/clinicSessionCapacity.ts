type ClinicCapacitySummary = {
  booking_mode?: "fixed_slot" | "time_range";
  is_full?: boolean;
  max_participants?: number | null;
  booked_count?: number;
  participant_count?: number;
};

/** 시간 범위 정원은 서버의 구간별 판단을 사용하고 누적 예약 수로 추정하지 않는다. */
export function isClinicSessionFull(session: ClinicCapacitySummary): boolean {
  if (typeof session.is_full === "boolean") return session.is_full;
  if (session.booking_mode === "time_range") return false;
  return session.max_participants != null
    && (session.booked_count ?? session.participant_count ?? 0) >= session.max_participants;
}
