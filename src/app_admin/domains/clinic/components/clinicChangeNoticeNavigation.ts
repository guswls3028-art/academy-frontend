import type { ClinicSessionUpdateNotice } from "./clinicScheduleConfirmation";

export function clinicChangeNoticeNavigationState(notice: ClinicSessionUpdateNotice) {
  return { clinicChangeNotice: notice };
}

export function readClinicChangeNoticeNavigationState(value: unknown): ClinicSessionUpdateNotice | null {
  if (!value || typeof value !== "object" || !("clinicChangeNotice" in value)) return null;
  const notice = value.clinicChangeNotice;
  if (!notice || typeof notice !== "object") return null;
  const candidate = notice as Partial<ClinicSessionUpdateNotice>;
  return typeof candidate.sessionId === "number" && Number.isInteger(candidate.sessionId) &&
    typeof candidate.date === "string" &&
    typeof candidate.oldSchedule === "string" &&
    typeof candidate.newSchedule === "string" &&
    typeof candidate.changed === "boolean"
    ? candidate as ClinicSessionUpdateNotice
    : null;
}
