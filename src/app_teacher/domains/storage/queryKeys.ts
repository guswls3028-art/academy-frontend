// PATH: src/app_teacher/domains/storage/queryKeys.ts
export const teacherStorageQueryKeys = {
  studentsForInventory: (search: string) => ["teacher-students-for-inventory", search] as const,
  studentInventory: (studentPs?: string) => ["teacher-student-inventory", studentPs] as const,
  adminInventory: ["teacher-storage-admin"] as const,
  quota: ["teacher-storage-quota"] as const,
};
