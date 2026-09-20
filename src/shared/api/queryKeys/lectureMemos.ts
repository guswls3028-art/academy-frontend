export const lectureMemoQueryKeys = {
  drafts: ["lecture-memo-draft"] as const,
  draft: (scope: string) => ["lecture-memo-draft", scope] as const,
  // Both role apps consume these existing roster roots.
  rosters: [["attendance"], ["session-attendance"], ["session-enrollments"], ["lecture-enrollments"]] as const,
};
