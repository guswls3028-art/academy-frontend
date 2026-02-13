// PATH: src/features/messages/hooks/useNotificationLog.ts

import { useQuery } from "@tanstack/react-query";
import {
  fetchNotificationLog,
  type NotificationLogParams,
  type NotificationLogResponse,
} from "../api/messages.api";

const KEY = ["messaging", "log"] as const;

const MOCK_LOG_RESPONSE: NotificationLogResponse = {
  results: [],
  count: 0,
};

export function useNotificationLog(params?: NotificationLogParams) {
  return useQuery({
    queryKey: [...KEY, params ?? {}],
    queryFn: async () => {
      try {
        return await fetchNotificationLog(params);
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 404) return MOCK_LOG_RESPONSE;
        throw e;
      }
    },
    staleTime: 30 * 1000,
  });
}
