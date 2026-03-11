// PATH: src/features/submissions/api/adminSubmissions.ts
import api from "@/shared/api/axios";
import type { Submission, SubmissionStatus } from "@/features/submissions/types";

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
  const query: any = {};
  if (Number.isFinite(params?.examId)) {
    query.target_type = "exam";
    query.target_id = params!.examId;
  }
  if (Number.isFinite(params?.enrollmentId)) query.enrollment_id = params!.enrollmentId;
  if (params?.status) query.status = params.status;
  if (Number.isFinite(params?.limit)) query.limit = params!.limit;

  const res = await api.get("/submissions/submissions/", { params: query });
  const data = res.data;

  if (Array.isArray(data)) return data as Submission[];
  if (Array.isArray(data?.results)) return data.results as Submission[];
  if (Array.isArray(data?.items)) return data.items as Submission[];
  return [];
}

/**
 * Unified retry (FAILED only)
 */
export async function retryAnySubmission(submissionId: number): Promise<{
  submission_id?: number;
  id?: number;
  status?: SubmissionStatus;
} | any> {
  const res = await api.post(`/submissions/submissions/${submissionId}/retry/`, {});
  return res.data;
}

/**
 * Manual review fetch
 */
export async function fetchSubmissionManualReview(submissionId: number): Promise<{
  identifier?: string | null;
  answers?: Array<{
    question_id?: number;
    question_no?: number;
    answer?: string;
    meta?: any;
  }>;
  meta?: any;
}> {
  const res = await api.get(`/submissions/submissions/${submissionId}/manual-edit/`);
  return res.data;
}

/**
 * Manual review save + regrade
 */
export async function saveSubmissionManualReview(submissionId: number, payload: {
  identifier?: string | null;
  answers: Array<{ question_id?: number; question_no?: number; answer: string }>;
}): Promise<any> {
  const res = await api.post(`/submissions/submissions/${submissionId}/manual-edit/`, payload);
  return res.data;
}
