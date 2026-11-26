// PATH: src/shared/api/queryKeys/clinic.ts

export const clinicQueryKeys = {
  notificationTeachers: (tenant: string | null) => ["clinic", "notification-teachers", tenant] as const,
  highlightIds: ["clinic-highlight-ids"] as const,
};
