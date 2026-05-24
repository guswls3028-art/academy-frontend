export const clinicQueryKeys = {
  participants: ["clinic-participants"] as const,
  participantsList: (params: object) => ["clinic-participants", params] as const,
  targets: ["clinic-targets"] as const,
  targetsBySection: (sectionId: number | null) => ["clinic-targets", sectionId] as const,
  settings: ["clinic-settings"] as const,
  idcard: ["clinic-idcard"] as const,
  sessionsTree: ["clinic-sessions-tree"] as const,
  sessionsTreeByMonth: (year: number, month: number) => ["clinic-sessions-tree", year, month] as const,
  sessionsTreeImport: (year: number, month: number, scope: "import" | "import-current") =>
    ["clinic-sessions-tree", year, month, scope] as const,
  sessionsMonth: ["clinic-sessions-month"] as const,
  sessionsMonthRange: (from: string, to: string) => ["clinic-sessions-month", from, to] as const,
  notificationCounts: ["admin", "notification-counts"] as const,
};
