// PATH: src/shared/api/contracts/submissions.ts
// Submission API contract

import api from "@/shared/api/axios";

export type SubmissionStatus =
  | "submitted"
  | "dispatched"
  | "extracting"
  | "needs_identification"
  | "answers_ready"
  | "grading"
  | "done"
  | "failed";

export type SubmissionSource =
  | "omr_scan"
  | "omr_manual"
  | "online"
  | "homework_image"
  | "homework_video"
  | "ai_match";

export type SubmissionTargetType = "exam" | "homework";
export type SubmissionJsonRecord = Record<string, unknown>;

/**
 * Backend Submission model contract.
 */
export type Submission = {
  id: number;
  enrollment_id: number | null;
  target_type: SubmissionTargetType;
  target_id: number;
  source: SubmissionSource;
  status: SubmissionStatus;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  payload?: SubmissionJsonRecord | null;
  meta?: SubmissionJsonRecord | null;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export type PendingSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  profile_photo_url?: string | null;
  target_type: SubmissionTargetType;
  target_id: number;
  target_title: string;
  lecture_id: number | null;
  lecture_title: string;
  session_id: number | null;
  source: string;
  status: SubmissionStatus;
  created_at: string;
  /** 백엔드 신필드 — orphan/결손 row 분기용 */
  target_resolved?: boolean;
  target_resolved_reason?: "target_missing" | "session_missing" | null;
  is_discarded?: boolean;
  discard_reason?: string | null;
};

/** 백엔드가 구형 pending/processing 반환 시 대비 */
export type ExamSubmissionStatus = SubmissionStatus | "graded" | "pending" | "processing";

export type ExamSubmissionRow = {
  id: number;
  enrollment_id: number | null;
  student_name: string;
  status: ExamSubmissionStatus;
  score: number | null;
  created_at: string;
};

export type SubmissionManualEditInput = {
  submissionId: number;
  identifier?: { enrollment_id: number | string } | Record<string, unknown> | null;
  note?: string;
  answers: Array<{
    exam_question_id: number;
    answer: string;
  }>;
};

export type SubmissionManualEditResult = {
  submission_id?: number;
  status?: ExamSubmissionStatus;
  updated?: number;
  graded?: boolean;
  result_id?: number | null;
  resolved_enrollment_id?: number | null;
  enrollment_id?: number | null;
  score?: number | null;
  total_score?: number | null;
  max_score?: number | null;
  detail?: string;
};

/** 폐기 사유 enum (backend submission_view._DISCARD_REASONS 와 동기) */
export type DiscardReason =
  | "scan_quality"
  | "wrong_upload"
  | "duplicate"
  | "target_missing"
  | "operator_discarded"
  | "other";

export const DISCARD_BATCH_MAX = 500;

const SUBMISSION_STATUSES = new Set<ExamSubmissionStatus>([
  "submitted",
  "dispatched",
  "extracting",
  "needs_identification",
  "answers_ready",
  "grading",
  "done",
  "failed",
  "graded",
  "pending",
  "processing",
]);

function isApiRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listFromApiResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isApiRecord(data)) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function numberFromApiValue(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringFromApiValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function statusFromApiValue(value: unknown): ExamSubmissionStatus {
  return typeof value === "string" && SUBMISSION_STATUSES.has(value as ExamSubmissionStatus)
    ? value as ExamSubmissionStatus
    : "pending";
}

function normalizeSubmissionRow(value: unknown): ExamSubmissionRow | null {
  if (!isApiRecord(value)) return null;
  const id = numberFromApiValue(value.id);
  if (!id || id <= 0) return null;

  const studentRecord = isApiRecord(value.student) ? value.student : null;
  const studentName =
    stringFromApiValue(value.student_name) ??
    stringFromApiValue(value.studentName) ??
    stringFromApiValue(studentRecord?.name) ??
    "";

  return {
    id,
    enrollment_id: numberFromApiValue(value.enrollment_id),
    student_name: studentName,
    status: statusFromApiValue(value.status),
    score: numberFromApiValue(value.score),
    created_at: stringFromApiValue(value.created_at) ?? "",
  };
}

export async function fetchPendingSubmissions(filter?: string): Promise<PendingSubmissionRow[]> {
  const params = filter ? { filter } : {};
  const res = await api.get("/submissions/submissions/pending/", { params });
  return listFromApiResponse(res.data) as PendingSubmissionRow[];
}

export async function listExamSubmissionsApi(examId: number): Promise<ExamSubmissionRow[]> {
  if (!Number.isFinite(examId) || examId <= 0) return [];
  const res = await api.get(`/submissions/submissions/exams/${examId}/`);
  return listFromApiResponse(res.data)
    .map(normalizeSubmissionRow)
    .filter((row): row is ExamSubmissionRow => row !== null);
}

export async function retrySubmissionApi(submissionId: number): Promise<unknown> {
  if (!Number.isFinite(submissionId) || submissionId <= 0) {
    throw new Error("유효하지 않은 submissionId");
  }
  const res = await api.post(`/submissions/submissions/${submissionId}/retry/`, {});
  return res.data;
}

export async function manualEditSubmissionApi(
  input: SubmissionManualEditInput & { allowDuplicate?: boolean },
): Promise<SubmissionManualEditResult> {
  const sid = Number(input.submissionId);
  if (!Number.isFinite(sid) || sid <= 0) {
    throw new Error("유효하지 않은 submissionId");
  }

  const answers = (input.answers ?? [])
    .filter((a) => a && Number.isFinite(Number(a.exam_question_id)))
    .map((a) => ({
      exam_question_id: Number(a.exam_question_id),
      answer: String(a.answer ?? ""),
    }))
    .filter((a) => a.answer.trim().length > 0);

  const payload = {
    identifier: input.identifier ?? null,
    answers,
    note: String(input.note || "manual_edit"),
  };

  const query = input.allowDuplicate ? "?allow_duplicate=1" : "";
  const res = await api.post(`/submissions/submissions/${sid}/manual-edit/${query}`, payload);
  return res.data;
}

export async function discardSubmissionApi(submissionId: number, reason?: DiscardReason | string) {
  const sid = Number(submissionId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("유효하지 않은 submissionId");
  const res = await api.post(`/submissions/submissions/${sid}/discard/`, {
    reason: reason || "operator_discarded",
  });
  return res.data;
}

export async function discardSubmissionsBatchApi(input: {
  submissionIds: number[];
  reason?: DiscardReason | string;
}): Promise<{ discarded: number; skipped_count: number; skipped: Array<{ id: number; reason: string }>; reason: string }> {
  const ids = (input.submissionIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) throw new Error("submissionIds 필수");
  if (ids.length > DISCARD_BATCH_MAX) {
    throw new Error(`한 번에 폐기 가능한 최대 건수는 ${DISCARD_BATCH_MAX}건입니다.`);
  }
  const res = await api.post(`/submissions/submissions/discard-batch/`, {
    submission_ids: ids,
    reason: input.reason || "operator_discarded",
  });
  return res.data;
}

export async function uploadOmrBatchApi(input: {
  examId: number;
  files: File[];
  sheetId?: number | string | null;
}): Promise<unknown> {
  const examId = Number(input.examId);
  if (!Number.isFinite(examId) || examId <= 0) throw new Error("유효하지 않은 examId");

  const files = input.files ?? [];
  if (!Array.isArray(files) || files.length === 0) throw new Error("files required");

  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  if (input.sheetId != null && String(input.sheetId).length > 0) {
    fd.append("sheet_id", String(input.sheetId));
  }

  const res = await api.post(`/submissions/submissions/exams/${examId}/omr/batch/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
