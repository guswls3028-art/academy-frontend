/**
 * PATH: src/features/exams/api/sessionEnrollments.ts
 *
 * ✅ SessionEnrollment API
 *
 * 설계 계약 (LOCKED):
 * - 단일 진실: SessionEnrollment
 * - 학생 식별자: enrollment_id (student_id ❌)
 *
 * API:
 * GET /api/v1/enrollments/session-enrollments/?session={sessionId}
 *
 * 방어 정책:
 * - 404 / 501 → 빈 배열 반환 (UI 깨짐 방지)
 * - 그 외 에러 → throw
 */

import api from "@/shared/api/axios";
import axios from "axios";

export type SessionEnrollment = {
  id: number;
  session: number;
  enrollment: number; // ⭐ 단일 진실
  student_name: string;
  created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function listPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.results)) return value.results;
  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function normalizeSessionEnrollment(value: unknown): SessionEnrollment {
  const row = isRecord(value) ? value : {};
  return {
    id: toNumber(row.id),
    session: toNumber(row.session),
    enrollment: toNumber(row.enrollment),
    student_name: toStringValue(row.student_name),
    created_at: toStringValue(row.created_at),
  };
}

export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollment[]> {
  try {
    const res = await api.get(
      `/enrollments/session-enrollments/`, // ✅ FIX: enrollments (s 포함)
      {
        params: { session: sessionId },
      }
    );

    /**
     * DRF pagination 대응
     */
    return listPayload(res.data).filter(isRecord).map(normalizeSessionEnrollment);
  } catch (err: unknown) {
    /**
     * 🔒 방어 규칙 (합의됨)
     * - 아직 API 미구현 / 권한 없음 → 빈 배열
     */
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 404 || status === 501) {
        return [];
      }
    }

    // 진짜 장애는 그대로 throw
    throw err;
  }
}
