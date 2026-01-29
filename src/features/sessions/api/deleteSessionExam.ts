// PATH: src/features/sessions/api/deleteSessionExam.ts
/**
 * ✅ Session Exam Delete (TEST MODE)
 * - 즉시 삭제 (안전장치 없음)
 * - exams list 단일진실은 results 도메인(admin-session-exams) 기준
 */

import api from "@/shared/api/axios";

export async function deleteSessionExam(examId: number) {
  const res = await api.delete(`/exams/${examId}/`);
  return res.data;
}
