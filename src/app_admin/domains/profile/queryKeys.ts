// PATH: src/app_admin/domains/profile/queryKeys.ts

export const adminProfileQueryKeys = {
  me: ["me"] as const,
  tenantInfo: ["tenant-info"] as const,
  myAttendance: (month: string) => ["my-attendance", month] as const,
  myAttendanceSummary: (month: string) => ["my-attendance-summary", month] as const,
  myExpenses: (month: string) => ["my-expenses", month] as const,
};
