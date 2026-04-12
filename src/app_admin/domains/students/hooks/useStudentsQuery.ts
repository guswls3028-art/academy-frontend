// PATH: src/app_admin/domains/students/hooks/useStudentsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStudents } from "../api/students.api";
import { resolveTenantCodeString } from "@/shared/tenant";

const PAGE_SIZE = 50;

export function useStudentsQuery(
  search: string,
  filters: any,
  sort: string,
  page: number = 1,
  deleted: boolean = false
) {
  const tenantCode = resolveTenantCodeString();
  return useQuery({
    queryKey: ["students", tenantCode, search, filters, sort, page, deleted],
    queryFn: async () => {
      const { data, count, pageSize } = await fetchStudents(search, filters, sort, page, deleted);
      return { data, count, pageSize: pageSize ?? PAGE_SIZE };
    },
    staleTime: 1000 * 5,
  });
}
