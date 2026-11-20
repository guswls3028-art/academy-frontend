export const surveyQueryKeys = {
  root: ["surveys"] as const,
  list: (status: string, search: string, offset: number) => ["surveys", "list", status, search, offset] as const,
  detail: (id: number) => ["surveys", "detail", id] as const,
  students: (search: string) => ["surveys", "student-choices", search] as const,
  responses: (id: number, status: string, offset: number) => ["surveys", "responses", id, status, offset] as const,
  statistics: (id: number) => ["surveys", "stats", id] as const,
  history: (studentId: number, offset: number) => ["surveys", "student-history", studentId, offset] as const,
  studentRoot: (studentId?: number) => ["student-surveys", studentId] as const,
  studentList: (studentId: number | undefined, offset: number) => ["student-surveys", studentId, offset] as const,
  studentDetail: (studentId: number | undefined, id: number) => ["student-survey", studentId, id] as const,
};
