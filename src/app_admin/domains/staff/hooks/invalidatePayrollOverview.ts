import type { QueryClient } from "@tanstack/react-query";

import { staffQueryKeys } from "../queryKeys";

export function invalidatePayrollOverview(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: staffQueryKeys.payrollOverviews });
}
