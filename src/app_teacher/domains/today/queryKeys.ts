// PATH: src/app_teacher/domains/today/queryKeys.ts

export const teacherTodayQueryKeys = {
  sessions: (date: string) => ["today-sessions", date] as const,
};
