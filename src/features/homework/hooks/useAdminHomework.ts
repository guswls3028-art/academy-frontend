// PATH: src/features/homework/hooks/useAdminHomework.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAdminHomework } from "../api/adminHomework";

export function useAdminHomework(homeworkId?: number) {
  const id = Number(homeworkId);

  return useQuery({
    queryKey: ["admin-homework", id],
    queryFn: () => fetchAdminHomework(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
