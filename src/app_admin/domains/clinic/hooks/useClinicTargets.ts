import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "../api/clinicTargets";
import type { ClinicTargetParams } from "../api/clinicTargets";
import { clinicQueryKeys } from "../queryKeys";

export function useClinicTargets(params?: ClinicTargetParams) {
  return useQuery({
    queryKey: clinicQueryKeys.targetsFiltered(params),
    queryFn: () => fetchClinicTargets(params),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
