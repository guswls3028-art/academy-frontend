export const staffWorkQueryKeys = {
  identity: ["staff-me"] as const,
  records: ["work-records"] as const,
  summary: ["staff-summary"] as const,
  currentlyWorking: ["work-currently-working"] as const,
  current: (staffId?: number) => ["work-current", staffId] as const,
};
