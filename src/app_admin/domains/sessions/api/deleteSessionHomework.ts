// PATH: src/app_admin/domains/sessions/api/deleteSessionHomework.ts
/**
 * Session-scoped homework removal.
 * - Backend archives the homework from active session workflows.
 * - Existing submission and score history remains preserved.
 * - Homework list SSOT is /homeworks/?session_id=.
 */

import api from "@/shared/api/axios";

export async function deleteSessionHomework(homeworkId: number) {
  const res = await api.delete(`/homeworks/${homeworkId}/`);
  return res.data;
}
