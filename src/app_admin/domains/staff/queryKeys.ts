import { staffWorkQueryKeys } from "@/shared/staff/queryKeys";

export const staffQueryKeys = {
  me: staffWorkQueryKeys.identity,
  staffs: ["staffs"] as const,
  staffsList: (params: object) => ["staffs", params] as const,
  staffsWorkTypes: ["staffs", "work-types"] as const,
  staff: ["staff"] as const,
  staffDetail: (staffId?: number) => ["staff", staffId] as const,
  summary: staffWorkQueryKeys.summary,
  summaryForStaff: (staffId: number) => ["staff-summary", staffId] as const,
  summaryRange: (staffId: number, from: string, to: string) => ["staff-summary", staffId, from, to] as const,
  payrollOverview: (year: number, month: number) => ["staff-payroll-overview", year, month] as const,
  reportSummary: (staffId: number, from: string, to: string) => ["staff-report-summary", staffId, from, to] as const,
  workRecords: staffWorkQueryKeys.records,
  workRecordsList: (params: object) => ["work-records", params] as const,
  workRecordsForStaff: (staffId: number) => ["work-records", staffId] as const,
  workMonthLocksForStaff: (staffId: number) => ["work-month-locks", staffId] as const,
  workMonthLocksForMonth: (staffId: number, year: number, month: number) =>
    ["work-month-locks", staffId, year, month] as const,
  workMonthLockHistory: (year: number, month: number) => ["work-month-lock-history", year, month] as const,
  expenses: ["expenses"] as const,
  expensesList: (params: object) => ["expenses", params] as const,
  expensesForStaff: (staffId: number) => ["expenses", staffId] as const,
  payrollSnapshots: ["payroll-snapshots"] as const,
  payrollSnapshotsList: (params: object) => ["payroll-snapshots", params] as const,
  payrollSnapshotMonth: (year: number, month: number, staffId?: number | null) =>
    ["payroll-snapshots", year, month, staffId] as const,
  payrollHistory: (staffId?: number) => ["payroll-history", staffId] as const,
  staffWorkTypes: (staffId: number) => ["staff-work-types", staffId] as const,
  workTypes: ["work-types"] as const,
};
