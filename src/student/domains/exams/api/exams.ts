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

export type StudentExamQuestion = {
  id: number;
  number: number;
  score: number;
};

export async function fetchStudentExamQuestions(
  examId: number
): Promise<StudentExamQuestion[]> {
  const res = await api.get(`/student/exams/${examId}/questions/`);
  const data = res.data;
  return Array.isArray(data) ? data : [];
}

export type SubmitAnswersPayload = {
  answers: Array<{ exam_question_id: number; answer: string }>;
};

export async function submitStudentExamAnswers(
  examId: number,
  payload: SubmitAnswersPayload
): Promise<{ submission_id: number; status: string }> {
  const res = await api.post(`/student/exams/${examId}/submit/`, payload);
  return res.data as { submission_id: number; status: string };
}
