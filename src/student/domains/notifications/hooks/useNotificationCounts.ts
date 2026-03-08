/**
 * 알림 카운트 훅
 * - refetchInterval 60초로 완화 (모바일 배터리·네트워크 부담 감소)
 * - queryClient에서 캐시된 프로필 사용하여 프로필 API 중복 호출 방지
 */
import { useQuery } from "@tanstack/react-query";
import { fetchNotificationCounts } from "../api/notifications.api";

export function useNotificationCounts() {
  return useQuery({
    queryKey: ["student", "notifications", "counts"],
    queryFn: ({ queryClient }) => {
      const profile = queryClient.getQueryData<{ id: number }>(["student", "me"]);
      return fetchNotificationCounts({ profile: profile ?? undefined });
    },
    refetchInterval: 60000, // 60초마다 갱신 (기존 30초에서 완화)
    refetchOnWindowFocus: false,
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}
