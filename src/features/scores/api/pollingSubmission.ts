import api from "@/shared/api/axios";

export type SubmissionStatus =
  | "SUBMITTED"
  | "PROCESSING"
  | "ANSWERS_READY"
  | "NEEDS_IDENTIFICATION"
  | "GRADED"
  | "FAILED";

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
  const res = await api.get(`/submissions/${submissionId}/`);
  return res.data as SubmissionDTO;
}
