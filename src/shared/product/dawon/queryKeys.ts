const groups = ["dawon", "class-groups"] as const;
const roster = ["dawon-roster"] as const;
const alerts = ["dawon", "teacher-alerts"] as const;

const operations = ["dawon", "admin", "operations"] as const;
const learning = ["dawon", "admin", "learning-review"] as const;

export const dawonQueryKeys = {
  adminOperations: operations,
  operationsOverview: (lecture?: string) => [...operations,lecture??"all"] as const,
  adminLearningRoot: learning,
  assignableInstructors: [...groups,"admin","instructors"] as const,
  adminGroups: [...groups, "admin"] as const,
  adminGroup: (id: number) => [...groups, "admin", id] as const,
  adminLearning: (params: Record<string, string>) => [...learning, params] as const,
  groups,
  group: (id: number) => [...groups, id] as const,
  lectureGroup: (id: number) => ["dawon", "lecture-group", id] as const,
  teachingClasses: ["dawon", "assigned-teaching-classes"] as const,
  courseSessions: (group: number, course?: number) => [...groups, group, "course-sessions", course] as const,
  courseExams: (group: number, course?: number) => [...groups, group, "course-exams", course] as const,
  roster,
  candidates: (url: string | undefined, search: string, offset: number) =>
    [...roster, url, search, offset] as const,
  alerts,
  lectureAlerts: (lecture: string) => [...alerts, lecture] as const,
};
