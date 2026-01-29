// PATH: src/features/staff/hooks/useExpenses.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchExpenses,
  patchExpense,
  createExpense,
  ExpenseStatus,
} from "../api/expenses.api";

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
    onSuccess: invalidate,
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchExpense(id, payload),
    onSuccess: invalidate,
  });

  return { listQ, createM, patchM };
}
