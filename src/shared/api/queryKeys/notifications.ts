// PATH: src/shared/api/queryKeys/notifications.ts

export const notificationQueryKeys = {
  registration: (scope: string | null) => ["lecture-registration-notices", scope] as const,
  accountDelivery: (studentId: number, logId: number) =>
    ["account-notification-delivery", studentId, logId] as const,
  operationalCounts: ["admin", "notification-counts"] as const,
  operationalCountsForRole: (includeConsult: boolean) =>
    ["admin", "notification-counts", { includeConsult }] as const,
};
