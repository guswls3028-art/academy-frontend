import type { components } from "@/shared/api/generated/schema";

export type LectureScheduleMode = components["schemas"]["ScheduleModeEnum"];

export type LectureScheduleDefault = components["schemas"]["LectureScheduleDefaultRequest"];

export type LectureScheduleSettings = {
  schedule_mode: LectureScheduleMode;
  schedule_defaults: LectureScheduleDefault[];
};

export const lectureWeekdays = ["월", "화", "수", "목", "금", "토", "일"];

export function lectureWeekday(date: string): number | null {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return Number.isNaN(day) ? null : day || 7;
}

export function offsetDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function datesFromLectureDefaults(defaults: LectureScheduleDefault[], referenceDate: string) {
  const weekday = lectureWeekday(referenceDate);
  return defaults.map((row, index) => ({
    key: `preset-${index}`,
    label: row.label,
    date: weekday === null ? "" : offsetDate(referenceDate, (row.weekday - weekday + 7) % 7),
  })).sort((a, b) => a.date.localeCompare(b.date));
}
