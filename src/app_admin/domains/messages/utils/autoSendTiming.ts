import type { AutoSendConfigItem, DelayMode } from "../api/messages.api";

export const REMINDER_TRIGGERS = new Set([
  "clinic_reminder",
  "lecture_session_reminder",
  "exam_start_minutes_before",
  "exam_scheduled_days_before",
  "assignment_due_hours_before",
  "payment_due_days_before",
]);

const REMINDER_UNIT_LABEL: Record<string, string> = {
  exam_scheduled_days_before: "일 전",
  assignment_due_hours_before: "시간 전",
  payment_due_days_before: "일 전",
};

export function isReminderTrigger(trigger: string): boolean {
  return REMINDER_TRIGGERS.has(trigger);
}

export function getReminderUnit(trigger: string): string {
  return REMINDER_UNIT_LABEL[trigger] ?? "분 전";
}

export function isAutoTriggerImplemented(config: AutoSendConfigItem): boolean {
  return config.implementation_status !== "manual_only"
    && config.implementation_status !== "disabled";
}

export function canUseDelayTiming(config: AutoSendConfigItem): boolean {
  return isAutoTriggerImplemented(config) && !isReminderTrigger(config.trigger);
}

export function defaultDelayValue(mode: DelayMode): number | null {
  if (mode === "scheduled_hour") return 9;
  if (mode === "delay_minutes") return 60;
  return null;
}

export function coerceDelayValue(mode: DelayMode, value: number | null | undefined): number | null {
  if (mode === "immediate") return null;
  if (mode === "scheduled_hour") {
    return value != null && value >= 0 && value <= 23
      ? value
      : defaultDelayValue(mode);
  }
  return value != null && value >= 1 ? value : defaultDelayValue(mode);
}
