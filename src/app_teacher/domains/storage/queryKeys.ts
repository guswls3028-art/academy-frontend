// PATH: src/app_teacher/domains/storage/queryKeys.ts
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const teacherStorageQueryKeys = {
  studentsForInventory: (search: string) => ["teacher-students-for-inventory", search] as const,
  studentInventory: (studentPs?: string) => ["teacher-student-inventory", studentPs] as const,
  adminInventory: ["teacher-storage-admin"] as const,
  quota: ["teacher-storage-quota"] as const,
};

export function readTeacherInventoryQueryGuard(queryClient: QueryClient, queryKey: QueryKey) {
  const state = queryClient.getQueryState(queryKey);
  return {
    ready: state?.status === "success" && state.error == null && state.fetchStatus === "idle",
    fence: `${state?.dataUpdateCount ?? 0}:${state?.errorUpdateCount ?? 0}:${state?.status ?? "pending"}:${state?.fetchStatus ?? "idle"}`,
  };
}
