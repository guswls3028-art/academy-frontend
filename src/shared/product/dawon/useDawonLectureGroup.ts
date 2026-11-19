import { dawonQueryKeys } from "./queryKeys";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { resolveTenantCodeString } from "@/shared/tenant";
export type LectureGroup = { group_id: number | null; name: string; school: string };
const root = "/students/class-groups/";

export function useDawonLectureGroup(lectureId: number, enabled: boolean) {
  const isDawon = resolveTenantCodeString() === "dawon";
  const query = useQuery({
    queryKey: dawonQueryKeys.lectureGroup(lectureId),
    enabled: isDawon && enabled && Number.isInteger(lectureId) && lectureId > 0,
    queryFn: async ({ signal }) => (await api.get<LectureGroup>(`${root}for-lecture/${lectureId}/`, { signal })).data,
  });
  return { isDawon, query };
}
