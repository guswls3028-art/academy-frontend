import api from "@/shared/api/axios";
import { expectedUpdatedAtHeaders } from "@/shared/api/optimisticConcurrency";
import type { components } from "@/shared/api/generated/schema";

/** Staff-only memo owned by one student's enrollment in one lecture. */
export type LectureMemo = components["schemas"]["LectureMemoResult"];

export async function fetchLectureMemo(enrollmentId: number): Promise<LectureMemo> {
  const { data } = await api.get<LectureMemo>(`/enrollments/${enrollmentId}/`);
  return data;
}

export async function saveLectureMemo(
  enrollmentId: number,
  memo: string,
  updatedAt: string,
): Promise<LectureMemo> {
  const { data } = await api.patch<LectureMemo>(
    `/enrollments/${enrollmentId}/lecture-memo/`,
    { lecture_memo: memo } satisfies components["schemas"]["PatchedLectureMemoRequest"],
    { headers: expectedUpdatedAtHeaders(updatedAt) },
  );
  return data;
}
