import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { fetchStudentDashboard } from "../api/dashboard.api";

/** 모바일 학생 앱: 재방문 시 즉시 표시 위해 캐시 유지 */
const STALE_TIME_MS = 60 * 1000;

export function useStudentDashboard() {
  return useQuery({
    queryKey: studentQueryKeys.dashboard,
    queryFn: fetchStudentDashboard,
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
