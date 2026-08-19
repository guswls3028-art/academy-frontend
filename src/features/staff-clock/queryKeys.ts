export const staffClockQueryKeys = {
  me: ["staff-me"] as const,
  current: (staffId?: number) => ["work-current", staffId] as const,
  currentlyWorking: ["work-currently-working"] as const,
  records: ["work-records"] as const,
  personalRecordsRoot: ["my-work-records"] as const,
  personalRecords: (staffId: number, from: string, to: string) =>
    ["my-work-records", staffId, from, to] as const,
  summary: ["staff-summary"] as const,
  personalSummaryRoot: ["my-work-summary"] as const,
  personalSummary: (staffId: number, from: string, to: string) =>
    ["my-work-summary", staffId, from, to] as const,
};
