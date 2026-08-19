import { staffWorkQueryKeys } from "@/shared/staff/queryKeys";

export const staffClockQueryKeys = {
  me: staffWorkQueryKeys.identity,
  current: staffWorkQueryKeys.current,
  currentlyWorking: staffWorkQueryKeys.currentlyWorking,
  records: staffWorkQueryKeys.records,
  personalRecordsRoot: ["my-work-records"] as const,
  personalRecords: (staffId: number, from: string, to: string) =>
    ["my-work-records", staffId, from, to] as const,
  summary: staffWorkQueryKeys.summary,
  personalSummaryRoot: ["my-work-summary"] as const,
  personalSummary: (staffId: number, from: string, to: string) =>
    ["my-work-summary", staffId, from, to] as const,
};
