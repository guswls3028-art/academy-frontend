// PATH: src/shared/api/queryKeys/account.ts

export const accountQueryKeys = {
  me: ["me"] as const,
  tenantInfo: ["tenant-info"] as const,
  tenantLabels: ["tenant-info", "labels"] as const,
};
