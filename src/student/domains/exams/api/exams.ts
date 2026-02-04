// PATH: src/student/domains/exams/api/exams.ts

import api from "@/student/shared/api/studentApi";

export type StudentExam = {
  id: number;
  title: string;
  open_at: string | null;
  close_at: string | null;
  allow_retake: boolean;
  max_attempts: number;
  pass_score: number;
  description?: string | null;
  session_id?: number | null;
};

export type ExamsListResponse = {
  items: StudentExam[];
};

export async function fetchStudentExams(): Promise<ExamsListResponse> {
  const res = await api.get("/student/exams/");
  const data = res.data;
  if (data?.items && Array.isArray(data.items)) return data as ExamsListResponse;
  if (Array.isArray(data)) return { items: data as StudentExam[] };
  return { items: [] };
}

export async function fetchStudentExam(examId: number): Promise<StudentExam> {
  const res = await api.get(`/student/exams/${examId}/`);
  return res.data as StudentExam;
}
