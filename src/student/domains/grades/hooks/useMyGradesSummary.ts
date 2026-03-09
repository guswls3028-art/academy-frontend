// PATH: src/student/domains/grades/hooks/useMyGradesSummary.ts

import { useQuery } from "@tanstack/react-query";
import { fetchMyGradesSummary } from "@/student/domains/grades/api/grades";

export function useMyGradesSummary() {
  return useQuery({
    queryKey: ["student", "grades", "summary"],
    queryFn: fetchMyGradesSummary,
  });
}
