/**
 * PATH: src/features/staff/hooks/useWorkMonthLock.ts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkMonthLocks,
  lockWorkMonth,
  isLockedFromLocks,
} from "../api/workMonthLocks.api"; // ??? IA  NOTE: legacy comment removed (encoding issue)

export function useWorkMonthLock(params: { staff: number; year: number; month: number }) {
  const qc = useQueryClient();

  const locksQ = useQuery({
    queryKey: ["work-month-locks", params.staff, params.year, params.month],
    queryFn: () =>
      fetchWorkMonthLocks({
        staff: params.staff,
        year: params.year,
        month: params.month,
      }),
    enabled: !!params.staff && !!params.year && !!params.month,
  });

  const locked = isLockedFromLocks(locksQ.data);

  const lockM = useMutation({
    mutationFn: () => lockWorkMonth({ staff: params.staff, year: params.year, month: params.month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-month-locks", params.staff] });
      qc.invalidateQueries({ queryKey: ["work-records", params.staff] });
      qc.invalidateQueries({ queryKey: ["expenses", params.staff] });
      qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
    },
  });

  return { locksQ, locked, lockM };
}




