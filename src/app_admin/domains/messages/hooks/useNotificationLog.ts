// PATH: src/app_admin/domains/messages/hooks/useNotificationLog.ts

import { useQuery } from "@tanstack/react-query";
import {
  fetchNotificationLog,
  type NotificationLogParams,
} from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";

export function useNotificationLog(params?: NotificationLogParams) {
  return useQuery({
    queryKey: messageQueryKeys.logList(params ?? {}),
    queryFn: () => fetchNotificationLog(params),
    staleTime: 30 * 1000,
  });
}
