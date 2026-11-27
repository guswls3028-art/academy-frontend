import type { Session } from "../../api/sessions";

// A recurring class name maps to a distinct, server-owned schedule ID each week.
// Legacy sections instead own separate sessions and are keyed by section ID.
export function rankingCohorts(sessions: Session[]) {
  const cohorts = new Map<string, { label: string; sessions: Map<number, string | undefined> }>();
  function add(key: string, label: string, sessionId: number, schedule?: string) {
    const cohort = cohorts.get(key) ?? { label, sessions: new Map<number, string | undefined>() };
    cohort.sessions.set(sessionId, schedule);
    cohorts.set(key, cohort);
  }
  for (const session of sessions) {
    if (session.section_type === "CLASS" && session.section && session.section_label) {
      const label = session.section_label.endsWith("반") ? session.section_label : `${session.section_label}반`;
      add(`section:${session.section}`, `${label} (개별 차시)`, session.id);
    }
    for (const day of session.schedule_dates ?? []) {
      add(`schedule:${day.label}`, day.label, session.id, String(day.id));
    }
  }
  return cohorts;
}
