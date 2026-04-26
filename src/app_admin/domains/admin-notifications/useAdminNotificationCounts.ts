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
    staleTime: 20 * 1000,
    // PC 운영 환경 + 응대 즉시성 우선. 학생용 60초보다 짧게.
    refetchInterval: 30 * 1000,
  });

  const counts: AdminNotificationCounts = q.data ?? {
    qnaPending: 0,
    counselPending: 0,
    clinicPending: 0,
    registrationRequestsPending: 0,
    recentSubmissions: 0,
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
