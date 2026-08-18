import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildOperationalNotificationItems,
  createEmptyOperationalNotificationCounts,
  fetchOperationalNotificationCounts,
  type OperationalNotificationCounts,
  type OperationalNotificationItem,
  type OperationalNotificationSource,
} from "@/shared/api/contracts/notifications";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import {
  arrivalOverviewQueryKey,
  fetchArrivalOverview,
} from "@/shared/api/contracts/arrivalOverview";
import useAuth from "@/auth/hooks/useAuth";

export function useOperationalNotificationCounts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const includeConsult = user?.tenantRole === "owner";
  const q = useQuery({
    queryKey: notificationQueryKeys.operationalCountsForRole(includeConsult),
    queryFn: () => fetchOperationalNotificationCounts(
      () => queryClient.fetchQuery({
        queryKey: arrivalOverviewQueryKey,
        queryFn: fetchArrivalOverview,
        staleTime: 20 * 1000,
      }),
      { includeConsult },
    ),
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
