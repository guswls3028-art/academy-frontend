// PATH: src/app_dev/shared/queryKeys.ts

export const devQueryKeys = {
  dashboardSummary: ["dev", "dashboard", "summary"] as const,
  audit: ["dev", "audit"] as const,
  auditLog: (filters: unknown) => ["dev", "audit", filters] as const,
  cron: ["dev", "cron"] as const,
  inbox: ["dev-platform-inbox"] as const,
  inboxItems: (filters: unknown) => ["dev-platform-inbox", filters] as const,
};
