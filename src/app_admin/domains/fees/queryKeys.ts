// PATH: src/app_admin/domains/fees/queryKeys.ts

export const adminFeesQueryKeys = {
  root: ["fees"] as const,
  dashboard: (year: number, month: number) => ["fees", "dashboard", year, month] as const,
  overdue: ["fees", "overdue"] as const,
  lectureOptions: ["fees", "lecture-options"] as const,
  invoices: (params: Record<string, string>) => ["fees", "invoices", params] as const,
  templates: ["fees", "templates"] as const,
};
