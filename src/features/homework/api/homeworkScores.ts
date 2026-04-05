// PATH: src/features/homework/api/homeworkScores.ts
/**
 * HomeworkScore API
 *
 * ✅ LOCKED SPEC
 * - GET   /homework/scores/?session=&lecture=&enrollment_id=&is_locked=
 * - PATCH /homework/scores/{id}/
 * - PATCH /homework/scores/quick/  (조교 빠른 입력)
 *
 * ✅ PATCH 에러 계약 (Backend 기준)
 * - is_locked == true → 409 + {code:"LOCKED", lock_reason?}
 *
 * ✅ 주의
 * - NO_SUBMISSION은 "PATCH 결과 payload 안에 progress.reason"으로 내려올 뿐,
 *   PATCH 자체가 409를 내지 않음 (현재 백엔드 구현 기준)
 *
 * 🚫 프론트 금지
 * - HomeworkScore 생성 ❌
 * - passed 계산 ❌ (서버 PATCH 결과만 신뢰)
 */

import api from "@/shared/api/axios";
import type { HomeworkScore } from "../types";

export type HomeworkPatchErrorCode = "LOCKED" | "UNKNOWN";

export type HomeworkPatchError = {
  code: HomeworkPatchErrorCode;
  detail: string;
  lock_reason?: string | null;
};

function normalizeScore(raw: any): HomeworkScore {
  return {
    id: Number(raw?.id),

    enrollment_id: Number(raw?.enrollment_id ?? raw?.enrollment ?? 0),
    session: Number(raw?.session ?? raw?.session_id ?? 0),

    score: raw?.score == null ? null : Number(raw.score),
    max_score: raw?.max_score == null ? null : Number(raw.max_score),

    teacher_approved: Boolean(raw?.teacher_approved ?? false),

    // ✅ backend 단일 진실 — null=판정기준없음, 그대로 유지
    passed: raw?.passed == null ? null : Boolean(raw.passed),
    clinic_required: Boolean(raw?.clinic_required ?? false),

    is_locked: Boolean(raw?.is_locked ?? false),
    lock_reason: (raw?.lock_reason ?? null) as any,

    updated_by_user_id:
      raw?.updated_by_user_id == null ? null : Number(raw.updated_by_user_id),

    meta: raw?.meta ?? null,

    created_at: String(raw?.created_at ?? ""),
    updated_at: String(raw?.updated_at ?? ""),
  };
}

/**
 * GET /homework/scores/
 */
export async function fetchHomeworkScores(params: {
  session?: number;
  lecture?: number;
  enrollment_id?: number;
  is_locked?: boolean;
}): Promise<HomeworkScore[]> {
  const res = await api.get("/homework/scores/", { params });

  const data = res.data;
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : [];

  return list.map(normalizeScore);
}

/**
 * PATCH /homework/scores/{id}/
 */
export async function patchHomeworkScore(
  id: number,
  payload: Partial<Pick<HomeworkScore, "score" | "max_score" | "teacher_approved">>
): Promise<HomeworkScore> {
  try {
    const res = await api.patch(`/homework/scores/${id}/`, payload);
    return normalizeScore(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const data = e?.response?.data;

    // ✅ backend LOCK 에러 규격
    if (status === 409 && String(data?.code).toUpperCase() === "LOCKED") {
      const err: HomeworkPatchError = {
        code: "LOCKED",
        detail: String(data?.detail ?? "score block is locked"),
        lock_reason: data?.lock_reason ?? null,
      };
      throw err;
    }

    const err: HomeworkPatchError = {
      code: "UNKNOWN",
      detail: String(data?.detail ?? e?.message ?? "PATCH failed"),
    };
    throw err;
  }
}

/**
 * PATCH /homework/scores/quick/
 *
 * ✅ Quick 입력 (조교 UX)
 * - percent 입력: score=85, max_score 생략/ null
 * - raw/max 입력: score=18, max_score=20
 *
 * ❗주의
 * - 이 호출은 "스냅샷 생성"을 의미하지만,
 *   프론트에서는 "HomeworkScore 생성 API를 따로 만들지 않는다"는 계약 유지
 *   → quick_patch만 upsert로 허용되는 통로
 */
export async function quickPatchHomeworkScore(payload: {
  session_id: number;
  enrollment_id: number;
  score: number;
  max_score?: number | null;
}): Promise<HomeworkScore> {
  try {
    const res = await api.patch(`/homework/scores/quick/`, payload);
    return normalizeScore(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const data = e?.response?.data;

    if (status === 409 && String(data?.code).toUpperCase() === "LOCKED") {
      const err: HomeworkPatchError = {
        code: "LOCKED",
        detail: String(data?.detail ?? "score block is locked"),
        lock_reason: data?.lock_reason ?? null,
      };
      throw err;
    }

    const err: HomeworkPatchError = {
      code: "UNKNOWN",
      detail: String(data?.detail ?? e?.message ?? "QUICK PATCH failed"),
    };
    throw err;
  }
}
