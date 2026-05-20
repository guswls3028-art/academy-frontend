// PATH: src/app_admin/domains/submissions/api/adminSubmissions.ts
import api from "@/shared/api/axios";
import type { Submission, SubmissionJsonRecord, SubmissionStatus } from "@admin/domains/submissions/types";

type AdminSubmissionsQuery = {
  target_type?: "exam";
  target_id?: number;
  enrollment_id?: number;
  status?: SubmissionStatus;
  limit?: number;
};

export type RetrySubmissionResponse = {
  submission_id?: number;
  id?: number;
  status?: SubmissionStatus;
  detail?: string;
};

export type SubmissionManualReviewAnswer = {
  question_id?: number;
  question_no?: number;
  answer?: string;
  omr?: SubmissionJsonRecord | null;
  meta?: SubmissionJsonRecord | null;
};

export type SubmissionManualReviewResponse = {
  submission_id?: number;
  submission_status?: SubmissionStatus;
  enrollment_id?: number | null;
  target_type?: Submission["target_type"];
  target_id?: number;
  identifier?: unknown;
  answers?: SubmissionManualReviewAnswer[];
  scan_image_url?: string;
  meta?: SubmissionJsonRecord | null;
};

export type SaveSubmissionManualReviewPayload = {
  identifier?: unknown;
  answers: Array<{ question_id?: number; question_no?: number; answer: string }>;
};

export type SaveSubmissionManualReviewResponse = {
  submission_id: number;
  status: SubmissionStatus;
  updated: number;
  graded: boolean;
  result_id?: number | null;
  resolved_enrollment_id?: number | null;
  enrollment_id?: number | null;
  score?: number | null;
  total_score?: number | null;
  max_score?: number | null;
  detail?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unwrapSubmissionList(data: unknown): Submission[] {
  if (Array.isArray(data)) return data as Submission[];
  const record = asRecord(data);
  if (Array.isArray(record.results)) return record.results as Submission[];
  if (Array.isArray(record.items)) return record.items as Submission[];
  return [];
}

/**
 * Admin submission list
 * - filters: exam_id(target_id), enrollment_id, status
 * - supports DRF pagination or plain array
 */
export async function fetchAdminSubmissions(params?: {
  examId?: number;
  enrollmentId?: number;
  status?: SubmissionStatus;
  limit?: number;
}): Promise<Submission[]> {
  const query: AdminSubmissionsQuery = {};
  if (Number.isFinite(params?.examId)) {
    query.target_type = "exam";
    query.target_id = params!.examId;
  }
  if (Number.isFinite(params?.enrollmentId)) query.enrollment_id = params!.enrollmentId;
  if (params?.status) query.status = params.status;
  if (Number.isFinite(params?.limit)) query.limit = params!.limit;

  const res = await api.get("/submissions/submissions/", { params: query });
  return unwrapSubmissionList(res.data);
}

/**
 * Unified retry (FAILED only)
 */
export async function retryAnySubmission(submissionId: number): Promise<RetrySubmissionResponse> {
  const res = await api.post(`/submissions/submissions/${submissionId}/retry/`, {});
  return res.data;
}

/**
 * Manual review fetch
 */
export async function fetchSubmissionManualReview(submissionId: number): Promise<SubmissionManualReviewResponse> {
  const res = await api.get(`/submissions/submissions/${submissionId}/manual-edit/`);
  return res.data;
}

/**
 * Manual review save + regrade
 */
export async function saveSubmissionManualReview(
  submissionId: number,
  payload: SaveSubmissionManualReviewPayload,
): Promise<SaveSubmissionManualReviewResponse> {
  const res = await api.post(`/submissions/submissions/${submissionId}/manual-edit/`, payload);
  return res.data;
}
