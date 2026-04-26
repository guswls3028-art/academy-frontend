// PATH: src/app_dev/domains/dashboard/hooks/useDashboard.ts
import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@dev/domains/dashboard/api/dashboard.api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dev", "dashboard", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
