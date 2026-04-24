// PATH: src/app_teacher/domains/results/api/submissions.ts
// 제출함 — 데스크톱 admin/submissions API 재사용
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

export type PendingSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  profile_photo_url?: string | null;
  target_type: "exam" | "homework";
  target_id: number;
  target_title: string;
  lecture_id: number;
  lecture_title: string;
  session_id: number;
  source: string;
  status: SubmissionStatus;
  created_at: string;
};

export async function fetchPendingSubmissions(filter?: string): Promise<PendingSubmissionRow[]> {
  const params = filter ? { filter } : {};
  const res = await api.get("/submissions/submissions/pending/", { params });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}
