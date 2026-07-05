// PATH: src/app_teacher/domains/clinic/queryKeys.ts

export const teacherClinicQueryKeys = {
  sessions: ["teacher-clinic-sessions"] as const,
  sessionsRange: (dateFrom: string, dateTo: string) =>
    ["teacher-clinic-sessions", dateFrom, dateTo] as const,
  participants: (sessionId: number) => ["teacher-clinic-participants", sessionId] as const,
  addStudents: (search: string) => ["clinic-add-students", search] as const,
  report: (year: number, month: number) => ["teacher-clinic-report", year, month] as const,
  settings: ["teacher-clinic-settings"] as const,
  sectionsRegular: ["teacher-clinic-sections-regular"] as const,
};
