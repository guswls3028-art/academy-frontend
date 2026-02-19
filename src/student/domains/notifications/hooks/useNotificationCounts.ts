/**
 * 알림 카운트 훅
 * 주기적으로 알림 수를 갱신 (30초마다)
 * 
 * 최적화:
 * - refetchOnWindowFocus: false로 불필요한 재요청 방지
 * - retry: 1로 실패 시 1회만 재시도
 * - staleTime과 refetchInterval 조정으로 적절한 갱신 주기 유지
 */
import { useQuery } from "@tanstack/react-query";
import { fetchNotificationCounts } from "../api/notifications.api";

export function useNotificationCounts() {
  return useQuery({
    queryKey: ["student", "notifications", "counts"],
    queryFn: fetchNotificationCounts,
    refetchInterval: 30000, // 30초마다 갱신
    refetchOnWindowFocus: false, // 창 포커스 시 자동 갱신 비활성화 (배터리 절약)
    staleTime: 10000, // 10초간 캐시 유지
    retry: 1, // 실패 시 1회만 재시도
    retryDelay: 2000, // 재시도 전 2초 대기
  });
}
