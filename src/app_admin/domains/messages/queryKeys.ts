export const messageQueryKeys = {
  autoSend: ["messaging", "auto-send"] as const,
  info: ["messaging", "info"] as const,
  log: ["messaging", "log"] as const,
  logList: (params: object) => ["messaging", "log", params] as const,
  templates: ["messaging", "templates"] as const,
  templatesByCategory: (category: string) => ["messaging", "templates", category] as const,
  customDefaultTemplate: ["messaging", "templates", "custom-default"] as const,
  scheduled: ["messaging", "scheduled"] as const,
  scheduledPending: ["messaging", "scheduled", "pending"] as const,
  operationsStatus: ["messaging", "operations-status"] as const,
};
