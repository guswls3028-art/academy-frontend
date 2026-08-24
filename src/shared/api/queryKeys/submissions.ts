// PATH: src/shared/api/queryKeys/submissions.ts

export const submissionsQueryKeys = {
  adminSubmissions: ["admin-submissions"] as const,
  adminPending: ["admin-pending-submissions"] as const,
  adminPendingList: (filter: unknown) => ["admin-pending-submissions", filter] as const,
  filePreview: (
    submissionId: number | undefined,
    fileKey: string | null,
    reviewSession: number,
  ) => ["submission-file-preview", submissionId, fileKey, reviewSession] as const,
};
