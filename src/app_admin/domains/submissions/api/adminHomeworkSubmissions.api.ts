import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

export type HomeworkSubmissionStatus =
  | SubmissionStatus
  | "graded"
  | "pending"
  | "processing"
  | "not_submitted"
  | "NOT_SUBMITTED";

export type HomeworkSubmissionMediaStatus = "uploading" | "uploaded" | "failed" | "removed" | string;

export type HomeworkSubmissionMediaFile = {
  id: string;
  legacy: boolean;
  position: number;
  original_filename: string;
  media_kind: "image" | "video";
  mime_type: string;
  file_size: number;
  status: HomeworkSubmissionMediaStatus;
  error_message: string;
  uploaded_at: string | null;
  failed_at: string | null;
  removed_at: string | null;
  created_at: string | null;
};

export type HomeworkSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  profile_photo_url?: string | null;
  status: HomeworkSubmissionStatus;
  source: string;
  file_type?: string | null;
  file_size?: number | null;
  files: HomeworkSubmissionMediaFile[];
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  teacher_reviewed: boolean;
  teacher_review_source: "manual" | "score" | null;
  teacher_review_note: string;
  teacher_reviewed_at: string | null;
  teacher_review_updated_at: string | null;
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
  if (value == null || value === "") return null;
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

function normalizeMediaFile(raw: unknown): HomeworkSubmissionMediaFile | null {
  const record = asRecord(raw);
  const id = String(record.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    legacy: record.legacy === true,
    position: asNumber(record.position),
    original_filename: String(record.original_filename ?? "제출 파일"),
    media_kind: record.media_kind === "video" ? "video" : "image",
    mime_type: String(record.mime_type ?? "application/octet-stream"),
    file_size: asNumber(record.file_size),
    status: String(record.status ?? "uploaded"),
    error_message: String(record.error_message ?? ""),
    uploaded_at: asNullableString(record.uploaded_at),
    failed_at: asNullableString(record.failed_at),
    removed_at: asNullableString(record.removed_at),
    created_at: asNullableString(record.created_at),
  };
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
    file_type: asNullableString(record.file_type),
    file_size: asNullableNumber(record.file_size),
    files: (Array.isArray(record.files) ? record.files : [])
      .map(normalizeMediaFile)
      .filter((file): file is HomeworkSubmissionMediaFile => file != null),
    lecture_title: asNullableString(record.lecture_title),
    lecture_color: asNullableString(record.lecture_color),
    lecture_chip_label: asNullableString(record.lecture_chip_label),
    name_highlight_clinic_target: record.name_highlight_clinic_target === true,
    teacher_reviewed: record.teacher_reviewed === true,
    teacher_review_source: record.teacher_review_source === "manual" || record.teacher_review_source === "score"
      ? record.teacher_review_source
      : null,
    teacher_review_note: String(record.teacher_review_note ?? ""),
    teacher_reviewed_at: asNullableString(record.teacher_reviewed_at),
    teacher_review_updated_at: asNullableString(record.teacher_review_updated_at),
    created_at: String(record.created_at ?? ""),
  };
}

export async function fetchHomeworkSubmissions(homeworkId: number): Promise<HomeworkSubmissionRow[]> {
  const res = await api.get(`/submissions/submissions/homework/${homeworkId}/`);
  return unwrapList(res.data).map(normalizeHomeworkSubmission);
}

export type HomeworkMediaPreview = {
  url: string;
  media_kind: "image" | "video";
  mime_type: string;
  original_filename: string;
  expires_in: number;
};

export async function fetchHomeworkMediaPreview(
  homeworkId: number,
  mediaId: string,
): Promise<HomeworkMediaPreview> {
  const res = await api.get<HomeworkMediaPreview>(
    `/submissions/submissions/homework/${homeworkId}/media/${encodeURIComponent(mediaId)}/preview/`,
  );
  return res.data;
}
