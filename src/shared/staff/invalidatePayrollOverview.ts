import type { QueryClient } from "@tanstack/react-query";

import { staffWorkQueryKeys } from "./queryKeys";

export function invalidatePayrollOverview(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: staffWorkQueryKeys.payrollOverviews });
}
