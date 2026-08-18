// PATH: src/shared/api/queryKeys/notifications.ts

export const notificationQueryKeys = {
  operationalCounts: ["admin", "notification-counts"] as const,
  operationalCountsForRole: (includeConsult: boolean) =>
    ["admin", "notification-counts", { includeConsult }] as const,
};
