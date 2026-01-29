// src/student/domains/exams/api/exams.ts
/**
 * ✅ Student Exams API (LOCK v1)
 *
 * 권장 엔드포인트:
 * - GET /api/v1/exams/ (학생도 공용 endpoint로 조회 가능하다는 전제)
 * - GET /api/v1/exams/{id}/
 *
 * 주의:
 * - open/close로 버튼 판단 ❌
 * - 재시험 가능 여부 판단 ❌ (Result API can_retake만 신뢰)
 */

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

export async function fetchStudentExams(params?: { session_id?: number }): Promise<ExamsListResponse> {
  const res = await api.get("/exams/", { params: params ?? {} });

  const data = res.data;
  if (data?.items && Array.isArray(data.items)) return data as ExamsListResponse;
  if (Array.isArray(data)) return { items: data as StudentExam[] };
  return { items: [] };
}

export async function fetchStudentExam(examId: number): Promise<StudentExam> {
  const res = await api.get(`/exams/${examId}/`);
  return res.data as StudentExam;
}
