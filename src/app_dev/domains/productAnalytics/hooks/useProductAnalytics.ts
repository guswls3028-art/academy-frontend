import { useQuery } from "@tanstack/react-query";
import { devQueryKeys } from "@dev/shared/queryKeys";
import {
  getProductAnalyticsOverview,
  type ProductAnalyticsFilters,
} from "../api/productAnalytics.api";

export function useProductAnalytics(filters: ProductAnalyticsFilters) {
  return useQuery({
    queryKey: devQueryKeys.productAnalytics(filters),
    queryFn: () => getProductAnalyticsOverview(filters),
    staleTime: 60_000,
  });
}
