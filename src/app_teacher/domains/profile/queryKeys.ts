// PATH: src/app_teacher/domains/profile/queryKeys.ts
import { teacherSharedQueryKeys } from "@teacher/shared/api/queryKeys";

export const teacherProfileQueryKeys = {
  expenses: (month: string) => ["my-expenses", month] as const,
  subscription: teacherSharedQueryKeys.subscription,
  billingCards: teacherSharedQueryKeys.billingCards,
};
