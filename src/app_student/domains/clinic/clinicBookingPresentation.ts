import { hhmmText as formatTime } from "@/shared/ui/time/timeFormat";

import type { ClinicBookingRequest, ClinicSession } from "./api/clinicBooking.api";
import type { ClinicCurrentTarget } from "./api/clinicSummary.api";

export function isSessionFull(session: ClinicSession): boolean {
  if (typeof session.is_full === "boolean") return session.is_full;
  return (
    session.max_participants != null &&
    (session.booked_count ?? 0) >= session.max_participants
  );
}

export function sessionMatchesTargets(
  session: ClinicSession,
  targetLectureIds: ReadonlySet<number>,
): boolean {
  if (targetLectureIds.size === 0) return false;
  const sessionLectureIds = (session.target_lecture_names ?? []).map(
    (lecture) => lecture.id,
  );
  return (
    sessionLectureIds.length === 0 ||
    sessionLectureIds.some((lectureId) => targetLectureIds.has(lectureId))
  );
}

export function targetReasonLabel(target: ClinicCurrentTarget): string {
  return target.source_type === "homework" ? "과제 보강" : "시험 보강";
}

export function targetResolutionLink(
  target: ClinicCurrentTarget,
): { to: string; label: string } | null {
  const sourceId = Number(target.source_id);
  if (!Number.isInteger(sourceId) || sourceId <= 0) return null;
  if (target.source_type === "homework") {
    return {
      to: `/student/submit/assignment?sessionId=${target.session_id}&homeworkId=${sourceId}`,
      label: "과제 온라인 제출",
    };
  }
  if (target.source_type === "exam") {
    return { to: `/student/exams/${sourceId}`, label: "시험 확인·제출" };
  }
  return null;
}

export function sortTargetsNewestFirst(
  left: ClinicCurrentTarget,
  right: ClinicCurrentTarget,
): number {
  const createdDifference = String(right.created_at ?? "").localeCompare(
    String(left.created_at ?? ""),
  );
  if (createdDifference !== 0) return createdDifference;
  return right.clinic_link_id - left.clinic_link_id;
}

export function displayTargetText(
  value: string | null | undefined,
  fallback: string,
): string {
  return value?.trim() || fallback;
}

export function sortBookings(left: ClinicBookingRequest, right: ClinicBookingRequest) {
  return `${left.session_date} ${left.session_start_time}`.localeCompare(
    `${right.session_date} ${right.session_start_time}`,
  );
}

export function hasValidPreferredRange(
  session: ClinicSession,
  preferredStart: string,
  preferredEnd: string,
): boolean {
  const sessionStart = session.start_time.slice(0, 5);
  const sessionEnd = session.end_time?.slice(0, 5);
  return !!sessionEnd && (
    sessionStart <= preferredStart &&
    preferredStart < preferredEnd &&
    preferredEnd <= sessionEnd
  );
}

export function preferredRangeText(request: ClinicBookingRequest): string | null {
  if (request.booking_start_time && request.booking_end_time) {
    return `이용 ${formatTime(request.booking_start_time)}–${formatTime(request.booking_end_time)}`;
  }
  if (!request.preferred_start_time || !request.preferred_end_time) return null;
  return `희망 ${formatTime(request.preferred_start_time)}–${formatTime(request.preferred_end_time)}`;
}
