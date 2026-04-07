// PATH: src/features/students/hooks/useStudentsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStudents } from "../api/students";
import { resolveTenantCode } from "@/shared/tenant";

const PAGE_SIZE = 50;

export function useStudentsQuery(
  search: string,
  filters: any,
  sort: string,
  page: number = 1,
  deleted: boolean = false
) {
  const tenantCode = resolveTenantCode().code ?? "unknown";
  return useQuery({
    queryKey: ["students", tenantCode, search, filters, sort, page, deleted],
    queryFn: async () => {
      const { data, count, pageSize } = await fetchStudents(search, filters, sort, page, deleted);
      return { data, count, pageSize: pageSize ?? PAGE_SIZE };
    },
    staleTime: 1000 * 5,
  });
}
