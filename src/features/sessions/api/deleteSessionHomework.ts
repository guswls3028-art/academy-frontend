// PATH: src/features/sessions/api/deleteSessionHomework.ts
/**
 * ✅ Session Homework Delete (TEST MODE)
 * - 즉시 삭제 (안전장치 없음)
 * - homeworks list 단일진실은 /homeworks/?session_id= 기준
 */

import api from "@/shared/api/axios";

export async function deleteSessionHomework(homeworkId: number) {
  const res = await api.delete(`/homeworks/${homeworkId}/`);
  return res.data;
}
