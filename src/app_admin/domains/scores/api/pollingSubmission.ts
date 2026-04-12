import api from "@/shared/api/axios";

export type SubmissionStatus =
  | "submitted"
  | "dispatched"
  | "extracting"
  | "needs_identification"
  | "graded"
  | "failed";

export type SubmissionDTO = {
  id: number;
  status: SubmissionStatus;
  enrollment_id: number | null;
  target_id: number;
  meta: any;
  error_message: string | null;
  updated_at: string;
};

export async function fetchSubmission(submissionId: number) {
  const res = await api.get(`/submissions/submissions/${submissionId}/`);
  return res.data as SubmissionDTO;
}
