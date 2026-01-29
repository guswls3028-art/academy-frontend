// PATH: src/features/homework/api/sessionEnrollments.ts
/**
 * SessionEnrollment API (homework wrapper)
 *
 * ✅ 단일 진실
 * - 학생 목록: SessionEnrollment
 * - 식별자: enrollment_id (student_id ❌)
 *
 * API:
 * - GET /enrollments/session-enrollments/?session={sessionId}
 */

import api from "@/shared/api/axios";
import type { SessionEnrollment } from "../types";

export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollment[]> {
  const res = await api.get("/enrollments/session-enrollments/", {
    params: { session: sessionId },
  });

  const data = res.data;
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : [];

  return list.map((raw: any) => ({
    id: Number(raw?.id),
    session: Number(raw?.session),
    enrollment: Number(raw?.enrollment),
    student_name: String(raw?.student_name ?? ""),
    created_at: String(raw?.created_at ?? ""),
  }));
}
