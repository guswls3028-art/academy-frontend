// PATH: src/app_student/shared/api/queryKeys.ts

export const studentQueryKeys = {
  me: ["student", "me"] as const,
  notificationCounts: ["student", "notifications", "counts"] as const,
  clinicBookings: ["student", "clinic", "bookings"] as const,
  qnaQuestions: ["student", "qna", "questions"] as const,
  counselRequests: ["student", "counsel", "requests"] as const,
  gradesSummary: ["student", "grades", "summary"] as const,
  gradesRoot: ["student", "grades"] as const,
  dashboard: ["student-dashboard"] as const,
  communityUnread: ["student", "community-unread"] as const,
  inventory: (ps: string) => ["student-inventory", ps] as const,
  storageQuota: ["storage-quota"] as const,
  attendanceSummary: ["student", "attendance", "summary"] as const,
  clinicIdcard: ["clinic-idcard"] as const,
  notices: ["student-notices"] as const,
  notice: (noticeId: number | null) => ["student-notice", noticeId] as const,
  feesInvoices: (studentId: number | null) =>
    ["student", "fees", "invoices", studentId] as const,
  feesInvoice: (studentId: number | null, invoiceId: number | null) =>
    ["student", "fees", "invoices", studentId, invoiceId] as const,
  feesPayments: (studentId: number | null) =>
    ["student", "fees", "payments", studentId] as const,
  examsRoot: ["student", "exams"] as const,
  examsList: (params?: { session_id?: number; include_upcoming?: boolean }) =>
    ["student", "exams", params ?? {}] as const,
};
