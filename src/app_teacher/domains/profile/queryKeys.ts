// PATH: src/app_teacher/domains/profile/queryKeys.ts
export const teacherProfileQueryKeys = {
  attendance: (month: string) => ["my-attendance", month] as const,
  expenses: (month: string) => ["my-expenses", month] as const,
  subscription: ["teacher-subscription"] as const,
  billingCards: ["teacher-billing-cards"] as const,
};
