const groups = ["dawon", "class-groups"] as const;
const roster = ["dawon-roster"] as const;
const alerts = ["dawon", "teacher-alerts"] as const;

export const dawonQueryKeys = {
  adminOperations: ["dawon", "admin", "operations"] as const,
  adminGroups: [...groups, "admin"] as const,
  adminGroup: (id: number) => [...groups, "admin", id] as const,
  adminLearning: (params: Record<string, string>) => ["dawon", "admin", "learning-review", params] as const,
  groups,
  group: (id: number) => [...groups, id] as const,
  lectureGroup: (id: number) => ["dawon", "lecture-group", id] as const,
  teachingClasses: ["dawon", "assigned-teaching-classes"] as const,
  roster,
  candidates: (url: string | undefined, search: string, offset: number) =>
    [...roster, url, search, offset] as const,
  alerts,
  lectureAlerts: (lecture: string) => [...alerts, lecture] as const,
};
