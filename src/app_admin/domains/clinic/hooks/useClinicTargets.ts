import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "../api/clinicTargets";

export function useClinicTargets(params?: { section_id?: number }) {
  return useQuery({
    queryKey: ["clinic-targets", params?.section_id ?? null],
    queryFn: () => fetchClinicTargets(params),
    staleTime: 10_000,
  });
}
