import { useMutation, useQueryClient } from "@tanstack/react-query";
import { feedback } from "@/shared/ui/feedback/feedback";
import { resolveClinicLink } from "../api/clinicLinks.api";
import type { ClinicTarget } from "../api/clinicTargets";
import { clinicQueryKeys } from "../queryKeys";

export function useResolveClinicLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, memo }: { id: number; memo?: string }) => resolveClinicLink(id, memo),
    onSuccess: async (link) => {
      await qc.cancelQueries({ queryKey: clinicQueryKeys.targets });
      qc.setQueriesData<ClinicTarget[]>({ queryKey: clinicQueryKeys.targets }, (rows) =>
        rows?.map((row) => row.clinic_link_id === link.id ? {
          ...row,
          resolved_at: link.resolved_at,
          resolution_type: link.resolution_type,
          resolution_evidence: link.resolution_evidence,
        } : row),
      );
      feedback.success("통과 처리되었습니다.");
      void qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
      void qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
    },
    onError: () => feedback.error("통과 처리에 실패했습니다."),
  });
}
