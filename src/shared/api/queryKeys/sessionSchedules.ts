export const sessionSchedulesKey = (sessionId: number) => ['session-schedules', sessionId] as const;

export const sessionScheduleQueryKeys = {
  session: sessionSchedulesKey,
  roster: (sessionId: number, schedule: string | undefined) =>
    [...sessionSchedulesKey(sessionId), 'roster', schedule] as const,
};
