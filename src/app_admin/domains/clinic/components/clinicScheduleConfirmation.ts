import dayjs from "dayjs";

export type ClinicSessionUpdateNotice = {
  sessionId: number;
  date: string;
  oldSchedule: string;
  newSchedule: string;
  changed: boolean;
};

export function formatClinicScheduleSnapshot(input: {
  date: string;
  start_time: string;
  duration_minutes?: number | null;
  location?: string | null;
}): string {
  const start = input.start_time.slice(0, 5);
  const base = [input.date, start, input.location?.trim()].filter(Boolean).join(" ");
  if (!input.duration_minutes || !start) return base;

  const [hour, minute] = start.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return base;
  const end = dayjs(input.date)
    .hour(hour)
    .minute(minute)
    .add(input.duration_minutes, "minute")
    .format("HH:mm");
  return [input.date, `${start}-${end}`, input.location?.trim()].filter(Boolean).join(" ");
}

type SharedSummary = {
  title: string;
  maxParticipants: number;
  filterSummary: string;
};

type CreateSummary = SharedSummary & {
  dateLabel: string;
  weekday: string;
  start: string;
  end: string;
  location: string;
  selectedCount: number;
};

export function buildClinicCreateConfirmationMessage(summary: CreateSummary) {
  return [
    "확인하면 해당 대상 학생의 예약 화면에 일정이 공개됩니다.",
    "",
    `일정 ${summary.dateLabel} (${summary.weekday}요일)`,
    `이름 ${summary.title || "클리닉"}`,
    `시간 ${summary.start}–${summary.end}`,
    `장소 ${summary.location}`,
    `정원 ${summary.maxParticipants}명`,
    `공개 대상 ${summary.filterSummary || "전체 학생"}`,
    summary.selectedCount > 0 ? `즉시 배정 ${summary.selectedCount}명` : "즉시 배정 없음",
  ].join("\n");
}

type EditSummary = SharedSummary & {
  before: string;
  after: string;
};

export function buildClinicEditConfirmationMessage(summary: EditSummary) {
  return [
    "저장하면 해당 대상 학생의 예약 화면에도 변경된 일정이 반영됩니다.",
    "",
    `변경 전 ${summary.before}`,
    `변경 후 ${summary.after}`,
    `이름 ${summary.title || "클리닉"}`,
    `정원 ${summary.maxParticipants}명`,
    `공개 대상 ${summary.filterSummary || "전체 학생"}`,
  ].join("\n");
}
