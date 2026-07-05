// PATH: src/app_admin/domains/staff/hooks/useStaffDetail.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStaffDetail } from "../api/staff.detail.api";
import { staffQueryKeys } from "../queryKeys";

/**
 * 🔒 Staff 단건 단일진실
 */
export function useStaffDetail(staffId?: number) {
  return useQuery({
    queryKey: staffQueryKeys.staffDetail(staffId),
    queryFn: () => fetchStaffDetail(staffId as number),
    enabled: typeof staffId === "number" && staffId > 0,
  });
}
