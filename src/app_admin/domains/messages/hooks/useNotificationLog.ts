// PATH: src/app_admin/domains/messages/hooks/useNotificationLog.ts

import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { resolveTenantCodeString } from "@/shared/tenant";
import {
  fetchNotificationLog,
  type NotificationLogParams,
} from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";

export function useNotificationLog(params?: NotificationLogParams) {
  const { user } = useAuth();
  const exactRequest = params?.request_id !== undefined;
  return useQuery({
    queryKey: [
      ...messageQueryKeys.logList(params ?? {}),
      resolveTenantCodeString(), user?.id, user?.tenantRole,
    ],
    queryFn: () => fetchNotificationLog(params),
    staleTime: exactRequest ? 0 : 30 * 1000,
    refetchOnMount: exactRequest ? "always" : true,
  });
}
