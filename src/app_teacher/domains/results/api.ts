// PATH: src/app_teacher/domains/results/api.ts
// 성적 조회 API
import api from "@/shared/api/axios";

/** 강의별 성적 목록 */
export async function fetchResults(params?: {
  lecture?: number;
  session?: number;
  exam?: number;
  page_size?: number;
}) {
  const res = await api.get("/results/", {
    params: { page_size: 200, ordering: "-created_at", ...params },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
