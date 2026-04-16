// PATH: src/app_admin/domains/staff/hooks/useExpenses.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchExpenses,
  patchExpense,
  createExpense,
  ExpenseStatus,
} from "../api/expenses.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

export type UseExpensesParams = {
  staff: number;
  status?: ExpenseStatus;
  date_from: string;
  date_to: string;
};

/**
 * 🔒 규칙
 * - 승인 상태 판단(추론) ❌  -> status 값 그대로 사용
 * - 합계 계산 ❌
 */
export function useExpenses(params: UseExpensesParams) {
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["expenses", params],
    queryFn: () => fetchExpenses(params),
    enabled: !!params.staff && !!params.date_from && !!params.date_to,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["staff-summary", params.staff] });
    qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
  };

  const createM = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { invalidate(); feedback.success("비용이 추가되었습니다."); },
    onError: (e: unknown) => feedback.error(extractApiError(e, "비용 추가에 실패했습니다.")),
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchExpense(id, payload),
    onSuccess: () => { invalidate(); feedback.success("비용이 처리되었습니다."); },
    onError: (e: unknown) => feedback.error(extractApiError(e, "비용 처리에 실패했습니다.")),
  });

  return { listQ, createM, patchM };
}
