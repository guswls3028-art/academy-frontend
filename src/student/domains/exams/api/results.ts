// PATH: src/student/domains/exams/api/results.ts

import api from "@/student/shared/api/studentApi";

export type MyExamResult = {
  exam_id: number;
  attempt_id: number;
  total_score: number;
  max_score: number;
  is_pass: boolean;
  submitted_at: string | null;
  can_retake: boolean;
};

export type MyExamResultItem = {
  question_id: number;
  question_number: number;
  student_answer: string | null;
  correct_answer: string | null;
  score: number;
  max_score: number;
  is_correct: boolean;
  meta?: Record<string, any>;
};

export async function fetchMyExamResult(examId: number): Promise<MyExamResult> {
  const res = await api.get(`/student/results/me/exams/${examId}/`);
  return res.data as MyExamResult;
}

export async function fetchMyExamResultItems(
  examId: number
): Promise<MyExamResultItem[]> {
  const res = await api.get(`/student/results/me/exams/${examId}/items/`);
  const data = res.data;
  if (Array.isArray(data?.items)) return data.items as MyExamResultItem[];
  if (Array.isArray(data)) return data as MyExamResultItem[];
  return [];
}
