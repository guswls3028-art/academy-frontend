// PATH: src/app_admin/domains/staff/hooks/useWorkRecords.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkRecords,
  createWorkRecord,
  patchWorkRecord,
  deleteWorkRecord,
} from "../api/workRecords.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

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
    onSuccess: () => { invalidate(); feedback.success("근무기록이 추가되었습니다."); },
    onError: (e: unknown) => feedback.error(extractApiError(e, "근무기록 추가에 실패했습니다.")),
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchWorkRecord(id, payload),
    onSuccess: () => { invalidate(); feedback.success("근무기록이 수정되었습니다."); },
    onError: (e: unknown) => feedback.error(extractApiError(e, "근무기록 수정에 실패했습니다.")),
  });

  const deleteM = useMutation({
    mutationFn: deleteWorkRecord,
    onSuccess: invalidate,
    onError: (e: unknown) => feedback.error(extractApiError(e, "근무기록 삭제에 실패했습니다.")),
  });

  return { listQ, createM, patchM, deleteM };
}
