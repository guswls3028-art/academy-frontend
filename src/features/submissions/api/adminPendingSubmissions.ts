// PATH: src/features/submissions/api/adminPendingSubmissions.ts
import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

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
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
};

export async function fetchPendingSubmissions(filter?: string): Promise<PendingSubmissionRow[]> {
  const params = filter ? { filter } : {};
  const res = await api.get("/submissions/submissions/pending/", { params });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}
