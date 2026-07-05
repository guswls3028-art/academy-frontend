// PATH: src/app_student/domains/clinic/queryKeys.ts

export const studentClinicQueryKeys = {
  bookings: ["student", "clinic", "bookings"] as const,
  availableSessions: ["student", "clinic", "available-sessions"] as const,
  idcard: ["clinic-idcard"] as const,
  notificationCounts: ["student", "notifications", "counts"] as const,
};
