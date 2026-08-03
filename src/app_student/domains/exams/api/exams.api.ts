// PATH: src/app_student/domains/exams/api/exams.ts

import api from "@student/shared/api/student.api";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

export type StudentExam = {
  id: number;
  title: string;
  open_at: string | null;
  close_at: string | null;
  allow_retake: boolean;
  max_attempts: number;
  pass_score: number;
  max_score: number;
  description?: string | null;
  session_id?: number | null;
  status?: string;
  has_result?: boolean;
  attempt_count?: number;
  student_results_published?: boolean;
};

export type ExamsListResponse = {
  items: StudentExam[];
};

function normalizeStudentExam(exam: StudentExam): StudentExam {
  return {
    ...exam,
    title: richHtmlToPlainText(exam.title),
    description: exam.description == null
      ? exam.description
      : richHtmlToPlainText(exam.description),
  };
}

export async function fetchStudentExams(params?: { session_id?: number; include_upcoming?: boolean }): Promise<ExamsListResponse> {
  const res = await api.get<ExamsListResponse | StudentExam[]>("/student/exams/", { params });
  const data = res.data;
  if (data && !Array.isArray(data) && Array.isArray(data.items)) {
    return { ...data, items: data.items.map(normalizeStudentExam) };
  }
  if (Array.isArray(data)) return { items: data.map(normalizeStudentExam) };
  return { items: [] };
}

export async function fetchStudentExam(examId: number): Promise<StudentExam> {
  const res = await api.get(`/student/exams/${examId}/`);
  return normalizeStudentExam(res.data as StudentExam);
}

export type StudentExamQuestion = {
  id: number;
  number: number;
  score: number;
  answer_format: "text" | "integer_0_999";
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
