// PATH: src/app_student/domains/clinic/queryKeys.ts

export const studentClinicQueryKeys = {
  bookings: ["student", "clinic", "bookings"] as const,
  availableSessions: ["student", "clinic", "available-sessions"] as const,
  availableSessionsOnDate: (date: string) => ["student", "clinic", "available-sessions", date] as const,
  availability: (sessionId: number | undefined) =>
    ["student", "clinic", "availability", sessionId] as const,
  summary: ["student", "clinic", "summary"] as const,
  notificationCounts: ["student", "notifications", "counts"] as const,
};
