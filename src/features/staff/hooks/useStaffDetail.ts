// PATH: src/features/staff/hooks/useStaffDetail.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStaffDetail } from "../api/staff.detail.api";

/**
 * 🔒 Staff 단건 단일진실
 */
export function useStaffDetail(staffId?: number) {
  return useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => fetchStaffDetail(staffId as number),
    enabled: typeof staffId === "number" && staffId > 0,
  });
}
