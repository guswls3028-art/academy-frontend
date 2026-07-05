// PATH: src/app_teacher/domains/students/queryKeys.ts

export const teacherStudentsQueryKeys = {
  students: ["students-mobile"] as const,
  studentList: (search: string, filters: object) => ["students-mobile", search, filters] as const,
  teacherStudents: ["teacher-students"] as const,
  student: (studentId: number) => ["student", studentId] as const,
  studentExams: (studentId: number) => ["student-exams", studentId] as const,
  accountNotifications: (studentId: number) => ["student-account-notifications", studentId] as const,
  clinic: (studentId: number) => ["student-clinic", studentId] as const,
  questions: (studentId: number) => ["student-questions", studentId] as const,
  allTags: ["all-tags"] as const,
};
