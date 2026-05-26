/**
 * 알림 카운트 훅
 * - refetchInterval 60초로 완화 (모바일 배터리·네트워크 부담 감소)
 * - queryClient에서 캐시된 프로필 사용하여 프로필 API 중복 호출 방지
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { fetchNotificationCounts } from "../api/notifications.api";

export function useNotificationCounts() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["student", "notifications", "counts"],
    queryFn: async () => {
      let profile = queryClient.getQueryData<{ id: number }>(["student", "me"]);
      if (profile?.id == null) {
        try {
          profile = await queryClient.ensureQueryData({
            queryKey: ["student", "me"],
            queryFn: fetchMyProfile,
            staleTime: 60_000,
          });
        } catch {
          profile = undefined;
        }
      }
      return fetchNotificationCounts({ profileId: profile?.id ?? null });
    },
    refetchInterval: 60000, // 60초마다 갱신 (기존 30초에서 완화)
    refetchOnWindowFocus: false,
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}
