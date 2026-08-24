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
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

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
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: staffQueryKeys.workMonthLocksForStaff(params.staff),
          refetchType: "all",
        }),
        qc.invalidateQueries({ queryKey: staffQueryKeys.workRecords, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: staffQueryKeys.expenses, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: staffQueryKeys.payrollSnapshots, refetchType: "all" }),
      ]);
      feedback.success(`${params.year}년 ${params.month}월 마감이 완료되었습니다.`);
    },
    onError: (error: unknown) => {
      feedback.error(
        extractApiError(
          error,
          "월 마감에 실패했습니다. 진행 중 근무와 대기 비용을 확인해 주세요."
        )
      );
    },
  });

  return {
    locksQ,
    locked,
    lockCheckPending: locksQ.isLoading,
    lockCheckFailed: locksQ.isError,
    lockM,
  };
}
