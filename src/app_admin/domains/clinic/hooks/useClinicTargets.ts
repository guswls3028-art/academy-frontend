import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "../api/clinicTargets";
import { clinicQueryKeys } from "../queryKeys";

export function useClinicTargets(params?: { section_id?: number }) {
  return useQuery({
    queryKey: clinicQueryKeys.targetsBySection(params?.section_id ?? null),
    queryFn: () => fetchClinicTargets(params),
    staleTime: 10_000,
  });
}
