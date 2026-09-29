import { messageTemplatesQueryKey, suppressedTemplateDefaultsQueryKey } from "@/shared/notifications/messageTemplateQueryKey";

export const messageQueryKeys = {
  academyName: (tenantCode: string | undefined) => ["messaging", "academy-name", tenantCode] as const,
  autoSend: ["messaging", "auto-send"] as const,
  info: ["messaging", "info"] as const,
  log: ["messaging", "log"] as const,
  logList: (params: object) => ["messaging", "log", params] as const,
  logDetail: (id: number) => ["messaging", "log", "detail", id] as const,
  logProviderDelivery: (id: number) => ["messaging", "log", "detail", id, "provider-delivery"] as const,
  templates: messageTemplatesQueryKey,
  suppressedDefaults: suppressedTemplateDefaultsQueryKey,
  templatesByCategory: (category: string) => [...messageTemplatesQueryKey, category] as const,
  customDefaultTemplate: [...messageTemplatesQueryKey, "custom-default"] as const,
  scheduled: ["messaging", "scheduled"] as const,
  scheduledPending: ["messaging", "scheduled", "pending"] as const,
  operationsStatus: ["messaging", "operations-status"] as const,
};
