// PATH: src/app_teacher/domains/staff/queryKeys.ts
export const teacherStaffQueryKeys = {
  staff: ["teacher-staff"] as const,
  staffList: (search: string) => ["teacher-staff", search] as const,
  staffOne: (staffId: number) => ["teacher-staff-one", staffId] as const,
  locks: (staffId: number, month: string) => ["teacher-staff-locks", staffId, month] as const,
  work: (staffId: number, month: string) => ["teacher-staff-work", staffId, month] as const,
  expense: (staffId: number, month: string) => ["teacher-staff-expense", staffId, month] as const,
  payroll: (staffId: number, year: number, month: number) => ["teacher-staff-payroll", staffId, year, month] as const,
  workTypes: ["teacher-staff-work-types"] as const,
};
