// PATH: src/features/staff/hooks/useStaffs.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStaffs } from "../api/staff.api";

export type UseStaffsParams = {
  search?: string;
  is_active?: boolean;
  is_manager?: boolean;
  pay_type?: string;
};

/**
 * 🔒 단일진실
 * - Staff 목록은 서버 그대로 신뢰
 */
export function useStaffs(params?: UseStaffsParams) {
  return useQuery({
    queryKey: ["staffs", params ?? {}],
    queryFn: () => fetchStaffs(params),
    staleTime: 10_000,
  });
}
