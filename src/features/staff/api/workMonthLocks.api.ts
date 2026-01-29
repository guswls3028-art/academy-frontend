// PATH: src/features/staff/api/workMonthLocks.api.ts
import api from "@/shared/api/axios";

export type WorkMonthLock = {
  id: number;
  staff: number;
  staff_name?: string;
  year: number;
  month: number;
  is_locked: boolean;
  locked_by?: number;
  locked_by_name?: string;
  created_at?: string;
};

/**
 * GET /staffs/work-month-locks/
 * ⚠️ backend는 staff/year/month 필터를 지원하지 않음
 */
export async function fetchWorkMonthLocks(params: {
  staff?: number;
  year: number;
  month: number;
}) {
  const res = await api.get("/staffs/work-month-locks/");

  const rows: WorkMonthLock[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  // 🔒 필터링은 계산이 아니라 "선택" → 허용
  return rows.filter(
    (r) =>
      r.year === params.year &&
      r.month === params.month &&
      (params.staff ? r.staff === params.staff : true)
  );
}

/**
 * POST /staffs/work-month-locks/
 */
export async function lockWorkMonth(payload: {
  staff: number;
  year: number;
  month: number;
}) {
  const res = await api.post("/staffs/work-month-locks/", payload);
  return res.data as WorkMonthLock;
}

export function isLockedFromLocks(
  locks: WorkMonthLock[] | undefined
): boolean {
  if (!locks || locks.length === 0) return false;
  return locks.some((l) => l.is_locked);
}
