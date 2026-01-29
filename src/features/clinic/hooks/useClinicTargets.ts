import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "../api/clinicTargets";

export function useClinicTargets() {
  return useQuery({
    queryKey: ["clinic-targets"],
    queryFn: fetchClinicTargets,
    staleTime: 10_000,
  });
}
