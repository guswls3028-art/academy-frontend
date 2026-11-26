import type { ClinicSession } from "./api/clinicBooking.api";

const DAY = 86_400_000;
const MINUTE = 60_000;
const displayTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function kst(date: string, time: string) {
  return Date.parse(`${date}T${time.slice(0, 5)}:00+09:00`);
}

type Cutoff = { deadline: number; blocked: boolean; pending: boolean };

function cutoffForInstant(session: ClinicSession, now: number, start: number): Cutoff | null {
  if (!session.booking_cutoff_at || !session.booking_cutoff_mode || session.booking_cutoff_mode === "none") return null;
  const anchor = kst(session.date, session.start_time);
  const base = Date.parse(session.booking_cutoff_at);
  // The server returns the cutoff for the operating start. Shift that reference to the selected arrival.
  const offset = session.booking_cutoff_mode === "before_start"
    ? start - anchor
    : Math.floor((start - kst(session.date, "00:00")) / DAY) * DAY;
  const deadline = base + offset;
  if (!Number.isFinite(deadline)) return null;
  const late = now >= deadline;
  const blocked = late && (now >= start || !session.allow_late_requests);
  return { deadline, blocked, pending: late && !blocked };
}

export function clinicCutoffForStart(session: ClinicSession, now: number, time: string, date?: string) {
  if (!time || !session.booking_cutoff_at) return null;
  const start = kst(date ?? session.date, time);
  const overnight = !date && time.slice(0, 5) < session.start_time.slice(0, 5);
  return cutoffForInstant(session, now, start + (overnight ? DAY : 0));
}

/** The session stays discoverable as long as its last possible arrival can be requested. */
export function clinicSessionCutoff(session: ClinicSession, now: number) {
  if (!session.booking_cutoff_at) return null;
  const start = kst(session.date, session.start_time);
  if (session.booking_mode !== "time_range") return cutoffForInstant(session, now, start);
  let end = session.end_time ? kst(session.end_date ?? session.date, session.end_time)
    : start + (session.duration_minutes ?? 0) * MINUTE;
  if (end < start && !session.end_date) end += DAY;
  const lastStart = Math.max(start, end - (session.booking_interval_minutes ?? 60) * MINUTE);
  return cutoffForInstant(session, now, lastStart);
}

export function describeClinicCutoff(cutoff: Cutoff) {
  return `신청 마감 ${displayTime.format(cutoff.deadline)} (한국 시간)`;
}
