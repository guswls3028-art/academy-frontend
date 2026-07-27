// PATH: src/app_admin/domains/staff/api/workMonthLocks.api.ts
import api from "@/shared/api/axios";

/** Backend: WorkMonthLockSerializer (no updated_at) */
export type WorkMonthLock = {
  id: number;
  staff: number;
  staff_name: string;
  year: number;
  month: number;
  is_locked: boolean;
  locked_by: number | null;
  locked_by_name: string | null;
  created_at: string;
};

/**
 * GET /staffs/work-month-locks/
 */
export async function fetchWorkMonthLocks(params: {
  staff?: number;
  year: number;
  month: number;
}) {
  const res = await api.get("/staffs/work-month-locks/", {
    params: { ...params, page_size: 500 },
  });

  const rows: WorkMonthLock[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  // 서버 필터가 계약의 정본이며, 이 검사는 잘못된 응답이 잠금을
  // 미마감으로 보이게 하지 않도록 하는 클라이언트 방어선입니다.
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
