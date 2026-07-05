// PATH: src/app_admin/domains/students/queryKeys.ts

import type { StudentFilters } from "./api/students.api";

export const adminStudentsQueryKeys = {
  students: ["students"] as const,
  studentsList: (
    tenantCode: string,
    search: string,
    filters: StudentFilters,
    sort: string,
    page: number,
    deleted: boolean,
  ) => ["students", tenantCode, search, filters, sort, page, deleted] as const,
  student: ["student"] as const,
  studentDetail: (studentId: number) => ["student", studentId] as const,
  studentGrades: (studentId: number) => ["student", studentId, "grades"] as const,
  studentClinic: (studentId: number) => ["student", studentId, "clinic"] as const,
  studentQuestions: (studentId: number) => ["student", studentId, "questions"] as const,
  studentAccountNotifications: (studentId: number) => ["student", studentId, "account-notifications"] as const,

  tags: ["students", "tags"] as const,
  tagsForTenant: (tenantCode: string) => ["students", "tags", tenantCode] as const,
  registrationRequests: ["students", "registration_requests"] as const,
  registrationRequestSettings: ["students", "registration_requests_settings"] as const,

  adminNotificationCounts: ["admin", "notification-counts"] as const,
  messagingAutoSend: ["messaging", "auto-send"] as const,
};
