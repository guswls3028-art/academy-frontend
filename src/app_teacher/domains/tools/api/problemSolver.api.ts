import api from "@/shared/api/axios";

export type ProblemSolverStatus =
  | "PENDING"
  | "VALIDATING"
  | "RUNNING"
  | "RETRYING"
  | "DONE"
  | "FAILED"
  | "REJECTED_BAD_INPUT"
  | "FALLBACK_TO_GPU"
  | "REVIEW_REQUIRED";

export type ProblemSolverResult = {
  answer: string;
  explanation: string;
  answer_check: string;
  confidence: "high" | "medium" | "low";
  review_status: "teacher_review_required";
  subject: string;
};

export type ProblemSolverJob = {
  job_id: string;
  status: ProblemSolverStatus;
  error: string;
  result: ProblemSolverResult | null;
};

export async function createProblemSolverJob(formData: FormData) {
  const { data } = await api.post<{ job_id: string; status: "PENDING" }>(
    "/tools/problem-solver/jobs/",
    formData,
  );
  return data;
}

export async function fetchProblemSolverJob(jobId: string) {
  const { data } = await api.get<ProblemSolverJob>(
    `/tools/problem-solver/jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}
