// PATH: src/app_student/domains/grades/hooks/useMyGradesSummary.ts

import { useQuery } from "@tanstack/react-query";
import { fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";

export function useMyGradesSummary(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: studentQueryKeys.gradesSummary,
    queryFn: fetchMyGradesSummary,
    staleTime: 60 * 1000,
    enabled: opts?.enabled ?? true,
  });
}
