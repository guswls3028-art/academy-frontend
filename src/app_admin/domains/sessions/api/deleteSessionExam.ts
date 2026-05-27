// PATH: src/app_admin/domains/sessions/api/deleteSessionExam.ts
/**
 * Session-scoped exam delete.
 * - With session_id, backend removes the exam from that session.
 * - If historical records exist, backend preserves them while hiding the exam from session workflows.
 * - Session exam list SSOT is results/admin/sessions/{sessionId}/exams/.
 */

import api from "@/shared/api/axios";

export async function deleteSessionExam(examId: number, sessionId?: number) {
  const res = await api.delete(`/exams/${examId}/`, {
    params: sessionId ? { session_id: sessionId } : undefined,
  });
  return res.data;
}
