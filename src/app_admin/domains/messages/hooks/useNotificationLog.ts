// PATH: src/app_admin/domains/messages/hooks/useNotificationLog.ts

import { useQuery } from "@tanstack/react-query";
import {
  fetchNotificationLog,
  type NotificationLogParams,
} from "../api/messages.api";

const KEY = ["messaging", "log"] as const;

export function useNotificationLog(params?: NotificationLogParams) {
  return useQuery({
    queryKey: [...KEY, params ?? {}],
    queryFn: () => fetchNotificationLog(params),
    staleTime: 30 * 1000,
  });
}
