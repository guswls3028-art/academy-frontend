const todaySessions = ["today-sessions"] as const;
const dailySessions = (date: string) => [...todaySessions, date] as const;
export const teacherTodayQueryKeys = {
  all: todaySessions,
  sessions: dailySessions,
  classSessions: (date: string, group: number | "assigned" | undefined) => [...dailySessions(date), group] as const,
};

export const sessionSchedulesKey = (sessionId: number) => ['session-schedules', sessionId] as const;

export const sessionScheduleQueryKeys = {
  session: sessionSchedulesKey,
  roster: (sessionId: number, schedule: string | undefined) =>
    [...sessionSchedulesKey(sessionId), 'roster', schedule] as const,
};
