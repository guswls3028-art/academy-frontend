// PATH: src/features/staff/hooks/useWorkRecords.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkRecords,
  createWorkRecord,
  patchWorkRecord,
  deleteWorkRecord,
} from "../api/workRecords.api";

export type UseWorkRecordsParams = {
  staff: number;
  work_type?: number;
  date_from: string;
  date_to: string;
};

/**
 * 🔒 규칙
 * - 시간/금액 계산 ❌
 * - 마감 여부 판단 ❌ (백엔드에서 400)
 */
export function useWorkRecords(params: UseWorkRecordsParams) {
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["work-records", params],
    queryFn: () => fetchWorkRecords(params),
    enabled:
      !!params.staff && !!params.date_from && !!params.date_to,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["work-records"] });
    qc.invalidateQueries({ queryKey: ["staff-summary", params.staff] });
    qc.invalidateQueries({ queryKey: ["payroll-snapshots"] });
  };

  const createM = useMutation({
    mutationFn: createWorkRecord,
    onSuccess: invalidate,
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchWorkRecord(id, payload),
    onSuccess: invalidate,
  });

  const deleteM = useMutation({
    mutationFn: deleteWorkRecord,
    onSuccess: invalidate,
  });

  return { listQ, createM, patchM, deleteM };
}
