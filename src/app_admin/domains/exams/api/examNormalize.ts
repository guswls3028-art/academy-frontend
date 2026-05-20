import { isApiRecord } from "@/shared/api/response";
import type { AnswerVisibility, Exam, ExamStatus, ExamType } from "../types";

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeExamType(value: unknown): ExamType {
  return value === "template" || value === "regular" ? value : "regular";
}

function normalizeStatus(value: unknown): ExamStatus {
  return value === "DRAFT" || value === "OPEN" || value === "CLOSED" ? value : "OPEN";
}

function normalizeAnswerVisibility(value: unknown): AnswerVisibility {
  return value === "after_closed" || value === "always" || value === "hidden"
    ? value
    : "hidden";
}

export function normalizeExam(raw: unknown): Exam {
  const data = isApiRecord(raw) ? raw : {};

  return {
    id: numberOr(data.id ?? data.exam_id, 0),

    title: text(data.title),
    description: text(data.description),
    subject: text(data.subject),

    exam_type: normalizeExamType(data.exam_type),

    is_active: data.is_active === true,
    status: normalizeStatus(data.status),

    allow_retake: data.allow_retake === true,
    max_attempts: numberOr(data.max_attempts, 0),

    pass_score: numberOr(data.pass_score, 0),
    max_score: numberOr(data.max_score, 100),
    display_order: numberOr(data.display_order, 0),

    open_at: nullableText(data.open_at),
    close_at: nullableText(data.close_at),

    template_exam_id: nullableNumber(data.template_exam_id),

    answer_visibility: normalizeAnswerVisibility(data.answer_visibility),

    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}
