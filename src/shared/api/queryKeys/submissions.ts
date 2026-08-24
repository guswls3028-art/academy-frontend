// PATH: src/shared/api/queryKeys/submissions.ts

export const submissionsQueryKeys = {
  adminSubmissions: ["admin-submissions"] as const,
  adminPending: ["admin-pending-submissions"] as const,
  adminPendingList: (filter: unknown) => ["admin-pending-submissions", filter] as const,
  filePreview: (
    submissionId: number | undefined,
    reviewSession: number,
  ) => ["submission-file-preview", submissionId, reviewSession] as const,
};
