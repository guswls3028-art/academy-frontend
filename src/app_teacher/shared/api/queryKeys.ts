// PATH: src/app_teacher/shared/api/queryKeys.ts
import { accountQueryKeys } from "@/shared/api/queryKeys/account";

export const teacherSharedQueryKeys = {
  tenantInfo: accountQueryKeys.tenantInfo,
  subscription: ["teacher-subscription"] as const,
  billingCards: ["teacher-billing-cards"] as const,
};
