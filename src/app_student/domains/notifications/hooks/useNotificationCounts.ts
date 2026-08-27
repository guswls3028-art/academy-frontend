/**
 * 알림 카운트 훅
 * - refetchInterval 60초로 완화 (모바일 배터리·네트워크 부담 감소)
 * - 캐시된 프로필은 재사용하되, cache miss 조회 실패는 알림 쿼리 자체의 retry/error로 종료
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { fetchNotificationCounts } from "../api/notifications.api";

export function useNotificationCounts() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: studentQueryKeys.notificationCounts,
    queryFn: async () => {
      let profile = queryClient.getQueryData<{ id: number }>(studentQueryKeys.me);
      if (profile?.id == null) {
        profile = await fetchMyProfile();
        queryClient.setQueryData(studentQueryKeys.me, profile);
      }
      if (profile?.id == null) {
        throw new Error("Student profile id is required for notification counts.");
      }
      return fetchNotificationCounts({ profileId: profile.id });
    },
    refetchInterval: 60000, // 60초마다 갱신 (기존 30초에서 완화)
    refetchOnWindowFocus: false,
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}
