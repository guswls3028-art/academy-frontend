// PATH: src/app_dev/domains/automation/hooks/useAutomation.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { devQueryKeys } from "@dev/shared/queryKeys";
import { getAuditLog, getCronList, triggerCron, type AuditFilters } from "@dev/domains/automation/api/automation.api";

export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: devQueryKeys.auditLog(filters),
    queryFn: () => getAuditLog(filters),
    staleTime: 15_000,
  });
}

export function useCronList() {
  return useQuery({
    queryKey: devQueryKeys.cron,
    queryFn: getCronList,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useTriggerCron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ command, args }: { command: string; args?: string[] }) =>
      triggerCron(command, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: devQueryKeys.cron });
      qc.invalidateQueries({ queryKey: devQueryKeys.audit });
    },
  });
}
