// PATH: src/features/staff/hooks/usePayrollSnapshots.ts
import { useQuery } from "@tanstack/react-query";
import { fetchPayrollSnapshots } from "../api/payrollSnapshots.api";

export type UsePayrollSnapshotsParams = {
  staff?: number;
  year?: number;
  month?: number;
};

/**
 * 🔒 PayrollSnapshot = 불변 단일진실
 * - 프론트 계산 ❌
 * - 수정 ❌
 */
export function usePayrollSnapshots(params: UsePayrollSnapshotsParams) {
  return useQuery({
    queryKey: ["payroll-snapshots", params],
    queryFn: () => fetchPayrollSnapshots(params),
  });
}
