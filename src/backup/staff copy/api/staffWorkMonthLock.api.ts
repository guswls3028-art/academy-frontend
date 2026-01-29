// PATH: src/features/staff/api/staffWorkMonthLock.api.ts
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
 * 특정 직원의 월 마감 조회 (또는 관리자: staff 없이 조회)
 */
export async function fetchWorkMonthLocks(params: {
  staff?: number;
  year: number;
  month: number;
}) {
  const res = await api.get("/staffs/work-month-locks/", { params })
;
  return res.data as WorkMonthLock[];
}

/**
 * 월 마감 실행 (관리자)
 */
export async function lockWorkMonth(payload: {
  staff: number;
  year: number;
  month: number;
}) {
  const res = await api.post("/work-month-locks/", payload);
  return res.data as WorkMonthLock;
}

/**
 * 백엔드 기준 마감 여부
 */
export function isLockedFromLocks(
  locks: WorkMonthLock[] | undefined
): boolean {
  if (!locks || locks.length === 0) return false;
  return locks.some((l) => !!l.is_locked);
}
