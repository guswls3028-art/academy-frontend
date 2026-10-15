import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
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
  media_set_fingerprint: string | null;
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

export function normalizeMediaFile(raw: unknown): HomeworkSubmissionMediaFile | null {
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
    teacher_review_source: record.teacher_review_source === "score" ? "score" : record.teacher_review_source === "manual" ? "manual" : null,
    teacher_review_note: String(record.teacher_review_note ?? ""),
    teacher_reviewed_at: asNullableString(record.teacher_reviewed_at),
    teacher_review_updated_at: asNullableString(record.teacher_review_updated_at),
    media_set_fingerprint: asNullableString(record.media_set_fingerprint),
    created_at: String(record.created_at ?? ""),
  };
}

/** Both staff surfaces publish a list only after every page is accounted for. */
export async function fetchHomeworkSubmissionRecords(homeworkId: number): Promise<unknown[]> {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 조회해 주세요.");
  const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
  const rows: unknown[] = [];
  const ids = new Set<number>();
  let expectedCount: number | undefined;
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<unknown>(`/submissions/submissions/homework/${homeworkId}/`, {
      ...config, params: { page, page_size: 200 },
    });
    const record = asRecord(data);
    const items = Array.isArray(data) ? data : record.results;
    const count = Array.isArray(data) ? undefined : record.count;
    const next = Array.isArray(data) ? null : record.next;
    if (!Array.isArray(items) || (page > 1 && Array.isArray(data))
      || (!Array.isArray(data) && (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0))
      || (next != null && (typeof next !== "string" || !next))) {
      throw new Error("제출 목록 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
    }
    if (page === 1) expectedCount = count as number | undefined;
    else if (count !== expectedCount) throw new Error("조회 중 제출 목록이 변경되었습니다. 다시 조회해 주세요.");
    for (const item of items) {
      const id = asRecord(item).id;
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || ids.has(id)) {
        throw new Error("제출 목록에 누락되거나 중복된 항목이 있습니다. 다시 조회해 주세요.");
      }
      ids.add(id);
      rows.push(item);
    }
    if (!next) {
      if (expectedCount !== undefined && rows.length !== expectedCount) {
        throw new Error("제출 목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
      }
      return rows;
    }
    if (!items.length || expectedCount === undefined || rows.length >= expectedCount) {
      throw new Error("제출 목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
    }
  }
}

export async function fetchHomeworkSubmissions(homeworkId: number): Promise<HomeworkSubmissionRow[]> {
  return (await fetchHomeworkSubmissionRecords(homeworkId)).map(normalizeHomeworkSubmission);
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
