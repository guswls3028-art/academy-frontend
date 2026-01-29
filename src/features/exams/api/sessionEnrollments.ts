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
    if (Array.isArray(res.data?.results)) {
      return res.data.results as SessionEnrollment[];
    }

    if (Array.isArray(res.data)) {
      return res.data as SessionEnrollment[];
    }

    return [];
  } catch (err: any) {
    /**
     * 🔒 방어 규칙 (합의됨)
     * - 아직 API 미구현 / 권한 없음 → 빈 배열
     */
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 404 || status === 501) {
        console.warn(
          "[SessionEnrollment] API not available yet. Return empty list."
        );
        return [];
      }
    }

    // 진짜 장애는 그대로 throw
    throw err;
  }
}
