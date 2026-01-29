// src/student/domains/exams/api/results.ts
/**
 * ✅ Student Result API (LOCK v1)
 * - 대표 결과 / 문항 상세는 백엔드 응답만 신뢰
 *
 * Endpoints (문서 기준):
 * - GET /results/me/exams/{exam_id}/
 * - GET /results/me/exams/{exam_id}/items/
 */

import api from "@/student/shared/api/studentApi";

export type MyExamResult = {
  exam_id: number;
  attempt_id: number;
  total_score: number;
  max_score: number;
  is_pass: boolean;
  submitted_at: string | null;
  can_retake: boolean;

  // 확장 필드가 있으면 그대로 받음 (예: clinic_required)
  [k: string]: any;
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
  const res = await api.get(`/results/me/exams/${examId}/`);
  return res.data as MyExamResult;
}

export async function fetchMyExamResultItems(examId: number): Promise<MyExamResultItem[]> {
  const res = await api.get(`/results/me/exams/${examId}/items/`);
  const data = res.data;
  if (Array.isArray(data?.items)) return data.items as MyExamResultItem[];
  if (Array.isArray(data)) return data as MyExamResultItem[];
  return [];
}
