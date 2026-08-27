import dayjs from "dayjs";
import type { ConfirmReview } from "@/shared/ui/confirm";

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

type CreateSummary = {
  title: string;
  maxParticipants: number;
  filterSummary: string;
  dateLabel: string;
  weekday: string;
  start: string;
  end: string;
  location: string;
  selectedCount: number;
  selectedStudentSummary: string;
  allowTimePreference: boolean;
};

export function buildClinicCreateConfirmationMessage() {
  return "일정과 공개 범위를 확인해 주세요. 확인 후 학생 예약 화면에 바로 반영됩니다.";
}

export function buildClinicCreateConfirmationReview(summary: CreateSummary): ConfirmReview {
  return {
    eyebrow: "클리닉 개설 검토",
    items: [
      { label: "일정", value: `${summary.dateLabel} (${summary.weekday}요일)` },
      { label: "이름", value: summary.title || "클리닉" },
      { label: "시간", value: `${summary.start}–${summary.end}`, tone: "accent" },
      { label: "장소", value: summary.location },
      { label: "정원", value: `${summary.maxParticipants}명` },
      { label: "공개 대상", value: summary.filterSummary || "전체 학생" },
      { label: "희망 시간", value: summary.allowTimePreference ? "학생 요청 받음" : "받지 않음" },
      {
        label: "즉시 배정",
        value: summary.selectedCount > 0
          ? `${summary.selectedStudentSummary} · ${summary.selectedCount}명`
          : "없음",
      },
    ],
    note: "확인하면 공개 대상 학생이 이 일정을 예약할 수 있습니다.",
  };
}

type EditSummary = {
  before: string;
  after: string;
  beforeTitle: string;
  afterTitle: string;
  beforeMaxParticipants: number;
  afterMaxParticipants: number;
  beforeFilterSummary: string;
  afterFilterSummary: string;
  beforeAllowTimePreference: boolean;
  afterAllowTimePreference: boolean;
};

export function buildClinicEditConfirmationMessage() {
  return "바뀌는 일정과 공개 범위를 확인해 주세요. 저장 후 학생 예약 화면에도 반영됩니다.";
}

export function buildClinicEditConfirmationReview(summary: EditSummary): ConfirmReview {
  return {
    eyebrow: "클리닉 변경 검토",
    items: [
      { label: "변경 전", value: summary.before },
      { label: "변경 후", value: summary.after, tone: "accent" },
      { label: "이름", value: `${summary.beforeTitle || "클리닉"} → ${summary.afterTitle || "클리닉"}` },
      { label: "정원", value: `${summary.beforeMaxParticipants}명 → ${summary.afterMaxParticipants}명` },
      { label: "공개 대상", value: `${summary.beforeFilterSummary || "전체 학생"} → ${summary.afterFilterSummary || "전체 학생"}` },
      {
        label: "희망 시간",
        value: `${summary.beforeAllowTimePreference ? "받음" : "받지 않음"} → ${summary.afterAllowTimePreference ? "받음" : "받지 않음"}`,
      },
    ],
    note: "예약 학생이 있으면 변경 후 운영 화면에서 알림 내용을 한 번 더 검토할 수 있습니다.",
  };
}
