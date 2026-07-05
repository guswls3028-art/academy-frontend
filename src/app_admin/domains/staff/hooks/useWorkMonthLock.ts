/**
 * PATH: src/features/staff/hooks/useWorkMonthLock.ts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkMonthLocks,
  lockWorkMonth,
  isLockedFromLocks,
} from "../api/workMonthLocks.api"; // ??? IA  NOTE: legacy comment removed (encoding issue)
import { staffQueryKeys } from "../queryKeys";

export function useWorkMonthLock(params: { staff: number; year: number; month: number }) {
  const qc = useQueryClient();

  const locksQ = useQuery({
    queryKey: staffQueryKeys.workMonthLocksForMonth(params.staff, params.year, params.month),
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
      qc.invalidateQueries({ queryKey: staffQueryKeys.workMonthLocksForStaff(params.staff) });
      qc.invalidateQueries({ queryKey: staffQueryKeys.workRecordsForStaff(params.staff) });
      qc.invalidateQueries({ queryKey: staffQueryKeys.expensesForStaff(params.staff) });
      qc.invalidateQueries({ queryKey: staffQueryKeys.payrollSnapshots });
      import("@/shared/ui/feedback/feedback").then(({ feedback }) => feedback.success(`${params.year}년 ${params.month}월 마감이 완료되었습니다.`));
    },
  });

  return { locksQ, locked, lockM };
}



