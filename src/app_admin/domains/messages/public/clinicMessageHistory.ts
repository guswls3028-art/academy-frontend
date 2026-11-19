export {
  fetchNotificationLog,
  fetchNotificationLogDetail,
  fetchScheduledNotifications,
  type NotificationLogItem,
  type ScheduledNotificationItem,
} from "../api/messages.api";

export const clinicMessageHistoryQueryKeys = {
  withViewerScope: (key: readonly unknown[], viewerScope: readonly unknown[]) => [...key, ...viewerScope] as const,
  logs: ["messaging", "clinic-history", "logs"] as const,
  scheduled: ["messaging", "clinic-history", "scheduled"] as const,
};
