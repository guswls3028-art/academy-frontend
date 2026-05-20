// SSOT ALIGN (backend domains/submissions):
// - list:    GET  /submissions/submissions/exams/<exam_id>/
// - retry:   POST /submissions/submissions/<submission_id>/retry/
// - manual:  POST /submissions/submissions/<submission_id>/manual-edit/
// - batch:   POST /submissions/submissions/exams/<exam_id>/omr/batch/  (multipart, files[])

import api from "@/shared/api/axios";
import type { SubmissionStatus } from "@admin/domains/submissions/types";
import {
  isApiRecord,
  listFromApiResponse,
  numberFromApiValue,
  stringFromApiValue,
} from "@admin/domains/materials/api/normalizers";

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
  // router: /submissions/submissions/<pk>/retry/
  const res = await api.post(`/submissions/submissions/${submissionId}/retry/`, {});
  return res.data;
}

export async function manualEditSubmissionApi(
  input: SubmissionManualEditInput & { allowDuplicate?: boolean },
): Promise<unknown> {
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

/** 폐기 사유 enum (backend submission_view._DISCARD_REASONS 와 동기) */
export type DiscardReason =
  | "scan_quality"
  | "wrong_upload"
  | "duplicate"
  | "target_missing"
  | "operator_discarded"
  | "other";

export async function discardSubmissionApi(submissionId: number, reason?: DiscardReason | string) {
  const sid = Number(submissionId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("유효하지 않은 submissionId");
  const res = await api.post(`/submissions/submissions/${sid}/discard/`, {
    reason: reason || "operator_discarded",
  });
  return res.data;
}

/** Backend `_DISCARD_REASONS` 와 동기. 1회 호출당 최대 500건. */
export const DISCARD_BATCH_MAX = 500;

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

  // urls.py: /submissions/submissions/exams/<exam_id>/omr/batch/
  const res = await api.post(`/submissions/submissions/exams/${examId}/omr/batch/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
