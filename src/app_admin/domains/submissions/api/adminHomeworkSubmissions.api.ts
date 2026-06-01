import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

export type HomeworkSubmissionStatus =
  | SubmissionStatus
  | "graded"
  | "pending"
  | "processing"
  | "not_submitted"
  | "NOT_SUBMITTED";

export type HomeworkSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  profile_photo_url?: string | null;
  status: HomeworkSubmissionStatus;
  source: string;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  created_at: string;
};

const HOMEWORK_SUBMISSION_STATUSES = new Set<HomeworkSubmissionStatus>([
  "submitted",
  "dispatched",
  "extracting",
  "needs_identification",
  "answers_ready",
  "grading",
  "done",
  "failed",
  "superseded",
  "graded",
  "pending",
  "processing",
  "not_submitted",
  "NOT_SUBMITTED",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function asNullableNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeStatus(value: unknown): HomeworkSubmissionStatus {
  return typeof value === "string" && HOMEWORK_SUBMISSION_STATUSES.has(value as HomeworkSubmissionStatus)
    ? value as HomeworkSubmissionStatus
    : "submitted";
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.results) ? record.results : [];
}

function normalizeHomeworkSubmission(raw: unknown): HomeworkSubmissionRow {
  const record = asRecord(raw);
  return {
    id: asNumber(record.id),
    enrollment_id: asNumber(record.enrollment_id),
    student_id: asNullableNumber(record.student_id),
    student_name: String(record.student_name ?? ""),
    profile_photo_url: asNullableString(record.profile_photo_url),
    status: normalizeStatus(record.status),
    source: String(record.source ?? ""),
    file_key: asNullableString(record.file_key),
    file_type: asNullableString(record.file_type),
    file_size: asNullableNumber(record.file_size),
    lecture_title: asNullableString(record.lecture_title),
    lecture_color: asNullableString(record.lecture_color),
    lecture_chip_label: asNullableString(record.lecture_chip_label),
    name_highlight_clinic_target: record.name_highlight_clinic_target === true,
    created_at: String(record.created_at ?? ""),
  };
}

export async function fetchHomeworkSubmissions(homeworkId: number): Promise<HomeworkSubmissionRow[]> {
  const res = await api.get(`/submissions/submissions/homework/${homeworkId}/`);
  return unwrapList(res.data).map(normalizeHomeworkSubmission);
}
