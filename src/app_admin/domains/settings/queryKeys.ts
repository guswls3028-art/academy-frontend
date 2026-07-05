// PATH: src/app_admin/domains/settings/queryKeys.ts

import { legalQueryKeys } from "@/shared/api/queryKeys/legal";

export const adminSettingsQueryKeys = {
  billingCards: ["billing-cards"] as const,
  subscriptionInfo: ["subscription-info"] as const,
  legalConfig: legalQueryKeys.config,
};
