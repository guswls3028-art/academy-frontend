import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

export type HomeworkSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  profile_photo_url?: string | null;
  status: SubmissionStatus;
  source: string;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  created_at: string;
};

export async function fetchHomeworkSubmissions(homeworkId: number) {
  const res = await api.get(`/submissions/submissions/homework/${homeworkId}/`);
  const data = res.data;
  if (Array.isArray(data)) return data as HomeworkSubmissionRow[];
  if (Array.isArray(data?.results)) return data.results as HomeworkSubmissionRow[];
  return [];
}
