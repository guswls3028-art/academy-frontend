// PATH: src/app_admin/domains/homework/api/sessionEnrollments.ts
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

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.results) ? record.results : [];
}

function normalizeSessionEnrollment(raw: unknown): SessionEnrollment {
  const record = asRecord(raw);
  return {
    id: asNumber(record.id),
    session: asNumber(record.session),
    enrollment: asNumber(record.enrollment),
    student_name: String(record.student_name ?? ""),
    created_at: String(record.created_at ?? ""),
  };
}

export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollment[]> {
  const res = await api.get("/enrollments/session-enrollments/", {
    params: { session: sessionId },
  });

  return unwrapList(res.data).map(normalizeSessionEnrollment);
}
