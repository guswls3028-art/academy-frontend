// PATH: src/shared/api/contracts/sessionEnrollments.ts
import axios from "axios";
import api from "@/shared/api/axios";

export type SessionEnrollmentRow = {
  id: number;
  session: number;
  enrollment: number;
  student_id?: number;
  student_name: string;
  student_school?: string | null;
  student_grade?: number | null;
  created_at?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function asNullableNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return [];
}

function normalizeSessionEnrollment(raw: unknown): SessionEnrollmentRow {
  const record = asRecord(raw);
  const studentId = asNullableNumber(record.student_id);
  return {
    id: asNumber(record.id),
    session: asNumber(record.session),
    enrollment: asNumber(record.enrollment),
    ...(studentId != null ? { student_id: studentId } : {}),
    student_name: asString(record.student_name),
    student_school: asNullableString(record.student_school),
    student_grade: asNullableNumber(record.student_grade),
    created_at: asString(record.created_at),
  };
}

export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollmentRow[]> {
  try {
    const res = await api.get("/enrollments/session-enrollments/", {
      params: { session: sessionId },
    });
    return unwrapList(res.data).map(normalizeSessionEnrollment);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404 || status === 501) {
        return [];
      }
    }
    throw err;
  }
}

export async function bulkCreateSessionEnrollments(
  sessionId: number,
  enrollmentIds: number[]
) {
  const res = await api.post("/enrollments/session-enrollments/bulk_create/", {
    session: sessionId,
    enrollments: enrollmentIds,
  });
  return res.data;
}
