// PATH: src/app_student/domains/grades/hooks/useMyGradesSummary.ts

import { useQuery } from "@tanstack/react-query";
import { fetchMyGradeRows, fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";

export function useMyGradeRows(opts?: { reuseFreshData?: boolean }) {
  return useQuery({
    queryKey: studentQueryKeys.gradeRows,
    queryFn: fetchMyGradeRows,
    staleTime: 60_000,
    refetchOnMount: opts?.reuseFreshData ? true : "always",
  });
}

export function useMyGradesSummary(opts?: { enabled?: boolean; reuseFreshData?: boolean }) {
  return useQuery({
    queryKey: studentQueryKeys.gradesSummary,
    queryFn: fetchMyGradesSummary,
    staleTime: 60 * 1000,
    refetchOnMount: opts?.reuseFreshData ? true : "always",
    enabled: opts?.enabled ?? true,
  });
}
