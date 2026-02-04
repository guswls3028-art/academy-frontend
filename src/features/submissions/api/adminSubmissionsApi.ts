import api from "@/shared/api/axios";

export type SubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  status: "pending" | "processing" | "done" | "failed";
  score: number | null;
  created_at: string;
};

export async function fetchExamSubmissions(examId: number) {
  const res = await api.get(`/submissions/exams/${examId}/`);

  const data = res.data;
  if (Array.isArray(data)) return data as SubmissionRow[];
  if (Array.isArray(data?.results)) return data.results as SubmissionRow[];

  return [];
}
