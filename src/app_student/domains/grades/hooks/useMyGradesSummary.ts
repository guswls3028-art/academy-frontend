// PATH: src/app_student/domains/grades/hooks/useMyGradesSummary.ts

import { useQuery } from "@tanstack/react-query";
import { fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";

export function useMyGradesSummary() {
  return useQuery({
    queryKey: ["student", "grades", "summary"],
    queryFn: fetchMyGradesSummary,
    staleTime: 60 * 1000,
  });
}
