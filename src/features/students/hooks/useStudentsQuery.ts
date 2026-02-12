// PATH: src/features/students/hooks/useStudentsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { fetchStudents } from "../api/students";

function compare(a: any, b: any, key: string) {
  const av = a[key];
  const bv = b[key];

  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;

  if (key === "registeredAt") {
    const at = new Date(av || "").getTime();
    const bt = new Date(bv || "").getTime();
    return at - bt;
  }

  if (typeof av === "boolean" && typeof bv === "boolean") {
    return Number(av) - Number(bv);
  }

  if (typeof av === "number" && typeof bv === "number") {
    return av - bv;
  }

  return String(av).localeCompare(String(bv), "ko");
}

const PAGE_SIZE = 50;

export function useStudentsQuery(
  search: string,
  filters: any,
  sort: string,
  page: number = 1,
  deleted: boolean = false
) {
  return useQuery({
    queryKey: ["students", search, filters, sort, page, deleted],
    queryFn: async () => {
      const { data, count } = await fetchStudents(search, filters, sort, page, deleted);

      if (!sort) return { data, count, pageSize: PAGE_SIZE };

      const isDesc = sort.startsWith("-");
      const key = isDesc ? sort.slice(1) : sort;

      const sorted = [...data].sort((a, b) => compare(a, b, key));
      const sortedData = isDesc ? sorted.reverse() : sorted;
      return { data: sortedData, count, pageSize: PAGE_SIZE };
    },
    staleTime: 1000 * 5,
  });
}
