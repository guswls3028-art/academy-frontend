// PATH: src/app_admin/domains/profile/queryKeys.ts

import { accountQueryKeys } from "@/shared/api/queryKeys/account";

export const adminProfileQueryKeys = {
  me: accountQueryKeys.me,
  tenantInfo: accountQueryKeys.tenantInfo,
  myAttendance: (month: string) => ["my-attendance", month] as const,
  myAttendanceSummary: (month: string) => ["my-attendance-summary", month] as const,
  myExpenses: (month: string) => ["my-expenses", month] as const,
};
