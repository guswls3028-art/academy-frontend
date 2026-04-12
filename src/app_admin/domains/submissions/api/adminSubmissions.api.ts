import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

export type SubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  profile_photo_url?: string | null;
  status: SubmissionStatus;
  source?: string;
  score: number | null;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  created_at: string;
};

export async function fetchExamSubmissions(examId: number) {
  // SSOT: GET /api/v1/submissions/submissions/exams/<exam_id>/
  const res = await api.get(`/submissions/submissions/exams/${examId}/`);

  const data = res.data;
  if (Array.isArray(data)) return data as SubmissionRow[];
  if (Array.isArray(data?.results)) return data.results as SubmissionRow[];

  return [];
}
