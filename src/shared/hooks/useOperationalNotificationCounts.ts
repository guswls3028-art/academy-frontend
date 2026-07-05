import { useQuery } from "@tanstack/react-query";
import {
  buildOperationalNotificationItems,
  createEmptyOperationalNotificationCounts,
  fetchOperationalNotificationCounts,
  type OperationalNotificationCounts,
  type OperationalNotificationItem,
  type OperationalNotificationSource,
} from "@/shared/api/contracts/notifications";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";

export function useOperationalNotificationCounts() {
  const q = useQuery({
    queryKey: notificationQueryKeys.operationalCounts,
    queryFn: fetchOperationalNotificationCounts,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });

  const counts: OperationalNotificationCounts = q.data?.counts ?? createEmptyOperationalNotificationCounts();
  const failures: OperationalNotificationSource[] = q.data?.failures ?? [];
  const items: OperationalNotificationItem[] = buildOperationalNotificationItems(counts);

  return {
    counts,
    items,
    failures,
    isLoading: q.isLoading,
    isError: q.isError,
    isFetching: q.isFetching,
    refetch: q.refetch,
  };
}
