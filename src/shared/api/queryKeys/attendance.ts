export const attendanceQueryKeys = {
  enrolledIds: (sessionId: number | null | undefined) => ["attendance-enrolled-ids", sessionId] as const,
} as const;
