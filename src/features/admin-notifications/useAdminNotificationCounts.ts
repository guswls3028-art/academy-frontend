/**
 * 선생앱 헤더 알림용 — QnA 답변 대기, 클리닉 예약 신청 건수
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminNotificationCounts,
  buildAdminNotificationItems,
  type AdminNotificationCounts,
  type AdminNotificationItem,
} from "./api";

export function useAdminNotificationCounts() {
  const q = useQuery({
    queryKey: ["admin", "notification-counts"],
    queryFn: fetchAdminNotificationCounts,
    staleTime: 60 * 1000, // 1분
    refetchInterval: 2 * 60 * 1000, // 2분마다
  });

  const counts: AdminNotificationCounts = q.data ?? {
    qnaPending: 0,
    clinicPending: 0,
    total: 0,
  };

  const items: AdminNotificationItem[] = buildAdminNotificationItems(counts);

  return {
    counts,
    items,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
