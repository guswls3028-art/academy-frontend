import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMaintenanceMode, setMaintenanceMode } from "@dev/domains/maintenance/api/maintenance.api";

const KEY = ["dev", "maintenance"] as const;

export function useMaintenanceMode() {
  return useQuery({
    queryKey: KEY,
    queryFn: getMaintenanceMode,
    staleTime: 15_000,
  });
}

export function useToggleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setMaintenanceMode(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
