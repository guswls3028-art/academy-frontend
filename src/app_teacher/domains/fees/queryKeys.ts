// PATH: src/app_teacher/domains/fees/queryKeys.ts
export const teacherFeesQueryKeys = {
  dashboard: ["teacher-fees-dashboard"] as const,
  dashboardMonth: (year: number, month: number) => ["teacher-fees-dashboard", year, month] as const,
  overdue: ["teacher-fees-overdue"] as const,
  invoices: ["teacher-fees-invoices"] as const,
  invoiceList: (filter: string, search: string) => ["teacher-fees-invoices", filter, search] as const,
  invoice: (invoiceId: number | null) => ["teacher-fees-invoice", invoiceId] as const,
};
