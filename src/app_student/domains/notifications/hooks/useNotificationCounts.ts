/**
 * 알림 카운트 훅
 * - refetchInterval 60초로 완화 (모바일 배터리·네트워크 부담 감소)
 * - 캐시된 프로필은 재사용하되, cache miss 조회 실패는 알림 쿼리 자체의 retry/error로 종료
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatch } from "react-router";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { fetchNotificationCounts, NOTIFICATION_COUNTS_REFRESH_INTERVAL_MS } from "../api/notifications.api";

export function useNotificationCounts() {
  const queryClient = useQueryClient();
  const fullGradeBoard = useMatch("/student/grades") !== null;
  return useQuery({
    queryKey: studentQueryKeys.notificationCounts,
    queryFn: async ({ signal }) => {
      const state = queryClient.getQueryState(studentQueryKeys.notificationCounts);
      // Retrying an error without data sets the status to pending before this callback.
      const recovering = state?.status === "error"
        || (state?.data === undefined && (state?.errorUpdatedAt ?? 0) > 0);
      const profile = await queryClient.fetchQuery({
        queryKey: studentQueryKeys.me,
        queryFn: fetchMyProfile,
        staleTime: Infinity,
        retry: false,
      });
      if (signal.aborted) throw new DOMException("Notification lookup was canceled", "AbortError");
      if (profile?.id == null) {
        throw new Error("Student profile id is required for notification counts.");
      }
      return fetchNotificationCounts({ profileId: profile.id, queryClient, recovering, fullGradeBoard });
    },
    refetchInterval: NOTIFICATION_COUNTS_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}
