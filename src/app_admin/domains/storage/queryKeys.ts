// PATH: src/app_admin/domains/storage/queryKeys.ts

export const storageQueryKeys = {
  matchupDocuments: ["matchup-documents"] as const,
  matchupProblemsRoot: ["matchup-problems"] as const,
  matchupProblems: (documentId: number) =>
    ["matchup-problems", documentId] as const,
  matchupDocPages: (documentId: number) =>
    ["matchup-doc-pages", documentId] as const,
  matchupPageStates: (documentId: number) =>
    ["matchup-page-states", documentId] as const,
  matchupPendingProposals: (documentId: number) =>
    ["matchup-proposals", documentId, "pending"] as const,
  matchupProposals: (documentId: number) =>
    ["matchup-proposals", documentId] as const,
  storageInventory: (scope: string) => ["storage-inventory", scope] as const,
};
