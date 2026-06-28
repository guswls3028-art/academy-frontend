// PATH: src/app_admin/domains/storage/queryKeys.ts

export const storageQueryKeys = {
  storageInventory: (scope: string) => ["storage-inventory", scope] as const,
  storageStudentInventory: (studentPs: string) =>
    ["storage-inventory", "student", studentPs] as const,
  storageQuota: ["storage-quota"] as const,
  storageStudentSearch: (search: string) =>
    ["storage-student-search", search] as const,
  storageThumb: (fileId: string, r2Key: string) =>
    ["storage-thumb", fileId, r2Key] as const,
  matchupDocuments: ["matchup-documents"] as const,
  matchupProblemsRoot: ["matchup-problems"] as const,
  matchupProblems: (documentId: number | null) =>
    ["matchup-problems", documentId] as const,
  matchupCrossMatches: (documentId: number | null) =>
    ["matchup-cross-matches", documentId] as const,
  matchupDocPages: (documentId: number) =>
    ["matchup-doc-pages", documentId] as const,
  matchupPageStates: (documentId: number) =>
    ["matchup-page-states", documentId] as const,
  matchupPendingProposals: (documentId: number) =>
    ["matchup-proposals", documentId, "pending"] as const,
  matchupProposals: (documentId: number) =>
    ["matchup-proposals", documentId] as const,
};
