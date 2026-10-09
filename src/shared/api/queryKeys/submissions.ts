// PATH: src/shared/api/queryKeys/submissions.ts

export const submissionsQueryKeys = {
  adminSubmissions: ["admin-submissions"] as const,
  adminPending: ["admin-pending-submissions"] as const,
  adminPendingList: (filter: string, failedType: string, page: number) =>
    ["admin-pending-submissions", filter, failedType, page] as const,
  filePreview: (
    submissionId: number | undefined,
    reviewSession: number,
  ) => ["submission-file-preview", submissionId, reviewSession] as const,
};
