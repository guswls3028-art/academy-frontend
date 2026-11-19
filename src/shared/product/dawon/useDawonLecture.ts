import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { resolveTenantCodeString } from "@/shared/tenant";

export type DawonLecture = {
  group_id: number | null;
  name: string;
  school: string;
  top_reference_percent: number | null;
  can_edit_top_reference: boolean;
};

export function dawonLectureKey(lectureId: number | null | undefined) {
  return ["dawon", "score-reference", lectureId] as const;
}

export function dawonLectureEndpoint(lectureId: number | null | undefined) {
  return `/students/class-groups/for-lecture/${lectureId}/`;
}

export function useDawonLecture(lectureId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: dawonLectureKey(lectureId),
    queryFn: async ({ signal }) => (await api.get<DawonLecture>(dawonLectureEndpoint(lectureId), { signal })).data,
    enabled: enabled && resolveTenantCodeString() === "dawon" && Boolean(lectureId),
    staleTime: 30_000,
  });
}
