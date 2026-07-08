import type { MessageTemplateCategory } from "../api/messages.api";
import type { TemplateCategory } from "./templateBlocks";

export type AlimtalkTemplateType =
  | "clinic_info"
  | "clinic_change"
  | "score"
  | "attendance"
  | "notice_withdrawal"
  | "notice_payment";

export const ALIMTALK_TEMPLATE_LABELS: Record<AlimtalkTemplateType, string> = {
  clinic_info: "클리닉 안내",
  clinic_change: "클리닉 일정 변경",
  score: "성적표 안내",
  attendance: "출석 안내",
  notice_withdrawal: "퇴원 처리 안내",
  notice_payment: "결제 완료 안내",
};

export const ALIMTALK_TEMPLATE_BODY_EDITABLE: Record<AlimtalkTemplateType, boolean> = {
  clinic_info: true,
  clinic_change: true,
  score: true,
  attendance: true,
  notice_withdrawal: false,
  notice_payment: false,
};

const CATEGORY_TO_TEMPLATE_TYPE: Partial<Record<MessageTemplateCategory | TemplateCategory, AlimtalkTemplateType>> = {
  grades: "score",
  attendance: "attendance",
  lecture: "attendance",
  exam: "attendance",
  assignment: "attendance",
  clinic: "clinic_info",
  payment: "notice_payment",
};

const TRIGGER_TO_TEMPLATE_TYPE: Record<string, AlimtalkTemplateType> = {
  clinic_reservation_created: "clinic_info",
  clinic_reminder: "clinic_info",
  clinic_check_in: "clinic_info",
  clinic_absent: "clinic_info",
  clinic_self_study_completed: "clinic_info",
  clinic_result_notification: "clinic_info",
  counseling_reservation_created: "clinic_info",
  clinic_reservation_changed: "clinic_change",
  clinic_cancelled: "clinic_change",
  check_in_complete: "attendance",
  absent_occurred: "attendance",
  lecture_session_reminder: "attendance",
  exam_scheduled_days_before: "attendance",
  exam_start_minutes_before: "attendance",
  exam_not_taken: "attendance",
  assignment_registered: "attendance",
  assignment_due_hours_before: "attendance",
  assignment_not_submitted: "attendance",
  retake_assigned: "clinic_info",
  exam_score_published: "score",
  monthly_report_generated: "score",
  withdrawal_complete: "notice_withdrawal",
  payment_complete: "notice_payment",
  payment_due_days_before: "notice_payment",
};

function isClinicChangeTemplate(templateName = "", extraVars?: Record<string, unknown>): boolean {
  const name = templateName.toLowerCase();
  if (name.includes("변경") || name.includes("취소")) return true;
  if (["change", "changed", "cancel", "cancelled", "canceled", "reschedule", "rescheduled"].some((k) => name.includes(k))) {
    return true;
  }
  if (!extraVars) return false;
  return Boolean(extraVars["클리닉기존일정"] || extraVars["클리닉변동사항"] || extraVars["클리닉수정자"]);
}

export function getAlimtalkTemplateTypeFromCategory(
  category?: string,
  templateName = "",
  extraVars?: Record<string, unknown>,
): AlimtalkTemplateType | null {
  if (!category) return null;
  const templateType = CATEGORY_TO_TEMPLATE_TYPE[category as MessageTemplateCategory | TemplateCategory];
  if (templateType === "clinic_info" && isClinicChangeTemplate(templateName, extraVars)) {
    return "clinic_change";
  }
  return templateType ?? null;
}

export function getAlimtalkTemplateType(trigger?: string): AlimtalkTemplateType | null {
  if (!trigger) return null;
  return TRIGGER_TO_TEMPLATE_TYPE[trigger] ?? null;
}

export function getAlimtalkTemplateLabel(templateType: AlimtalkTemplateType | null | undefined): string {
  return templateType ? ALIMTALK_TEMPLATE_LABELS[templateType] : "알림톡";
}

export function isAlimtalkTemplateBodyEditable(templateType: AlimtalkTemplateType | null | undefined): boolean {
  return templateType ? ALIMTALK_TEMPLATE_BODY_EDITABLE[templateType] : true;
}
