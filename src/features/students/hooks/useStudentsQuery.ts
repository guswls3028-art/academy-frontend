// PATH: src/features/students/hooks/useStudentsQuery.ts

import { useQuery } from "@tanstack/react-query";
import { fetchStudents } from "../api/students";

export function useStudentsQuery(
  search: string,
  filters: any,
  sort: string
) {
  return useQuery({
    queryKey: ["students", search, filters, sort],
    queryFn: async () => {
      const data = await fetchStudents(search, filters);

      if (sort === "name") {
        return [...data].sort((a, b) => a.name.localeCompare(b.name));
      }

      if (sort === "date") {
        return [...data].sort(
          (a, b) =>
            new Date(b.registeredAt || "").getTime() -
            new Date(a.registeredAt || "").getTime()
        );
      }

      return data;
    },
    staleTime: 1000 * 5,
  });
}
