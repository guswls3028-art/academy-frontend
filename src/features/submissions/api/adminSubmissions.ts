// PATH: src/features/submissions/api/adminSubmissions.ts
import api from "@/shared/api/axios";
import type { Submission, SubmissionStatus } from "@/features/submissions/types";

const CANDIDATE_BASES = ["/submissions", "/submissions/submissions"] as const;

async function tryGet<T>(paths: string[], params?: any): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await api.get(p, { params });
      return res.data as T;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function tryPost<T>(paths: string[], body?: any): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await api.post(p, body ?? {});
      return res.data as T;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * ✅ Admin submission list (best-effort)
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

  const paths: string[] = [];
  for (const b of CANDIDATE_BASES) {
    paths.push(`${b}/admin/submissions/`);
    paths.push(`${b}/submissions/`);
    paths.push(`${b}/`);
  }

  const data = await tryGet<any>(paths, query);

  if (Array.isArray(data)) return data as Submission[];
  if (Array.isArray(data?.results)) return data.results as Submission[];
  if (Array.isArray(data?.items)) return data.items as Submission[];
  return [];
}

/**
 * ✅ Unified retry (FAILED only)
 * - tries both public and admin base paths
 */
export async function retryAnySubmission(submissionId: number): Promise<{
  submission_id?: number;
  id?: number;
  status?: SubmissionStatus;
} | any> {
  const paths: string[] = [];
  for (const b of CANDIDATE_BASES) {
    paths.push(`${b}/${submissionId}/retry/`);
    paths.push(`${b}/submissions/${submissionId}/retry/`);
  }
  return tryPost<any>(paths, {});
}

/**
 * ✅ Manual review fetch (best-effort)
 * - expects shape:
 *   {
 *     identifier?: string | null,
 *     answers?: Array<{ question_id?: number; question_no?: number; answer?: string; meta?: any }>,
 *     meta?: any
 *   }
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
  const paths: string[] = [];
  for (const b of CANDIDATE_BASES) {
    paths.push(`${b}/${submissionId}/manual-review/`);
    paths.push(`${b}/${submissionId}/manual_edit/`);
    paths.push(`${b}/${submissionId}/manual-edit/`);
    paths.push(`${b}/submissions/${submissionId}/manual-review/`);
    paths.push(`${b}/submissions/${submissionId}/manual_edit/`);
    paths.push(`${b}/submissions/${submissionId}/manual-edit/`);
  }
  return tryGet<any>(paths);
}

/**
 * ✅ Manual review save + regrade (best-effort)
 * - payload contract is intentionally minimal and append-only friendly:
 *   {
 *     identifier?: string | null,
 *     answers?: Array<{ question_id?: number; question_no?: number; answer: string }>
 *   }
 */
export async function saveSubmissionManualReview(submissionId: number, payload: {
  identifier?: string | null;
  answers: Array<{ question_id?: number; question_no?: number; answer: string }>;
}): Promise<any> {
  const paths: string[] = [];
  for (const b of CANDIDATE_BASES) {
    paths.push(`${b}/${submissionId}/manual-review/`);
    paths.push(`${b}/${submissionId}/manual_edit/`);
    paths.push(`${b}/${submissionId}/manual-edit/`);
    paths.push(`${b}/submissions/${submissionId}/manual-review/`);
    paths.push(`${b}/submissions/${submissionId}/manual_edit/`);
    paths.push(`${b}/submissions/${submissionId}/manual-edit/`);
  }
  return tryPost<any>(paths, payload);
}
