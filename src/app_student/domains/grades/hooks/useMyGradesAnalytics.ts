import { useQuery } from "@tanstack/react-query";
import { fetchMyGradesAnalytics } from "@student/domains/grades/api/grades.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";

export function useMyGradesAnalytics(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: studentQueryKeys.gradesAnalytics,
    queryFn: fetchMyGradesAnalytics,
    staleTime: 60 * 1000,
    enabled: opts?.enabled ?? true,
  });
}
