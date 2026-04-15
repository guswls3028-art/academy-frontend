// PATH: src/app_teacher/domains/students/api.ts
// 학생 API — 기존 students API 래핑 (모바일 전용 정규화)
import api from "@/shared/api/axios";

/** 학생 목록 (페이지네이션) */
export async function fetchStudents(params?: {
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await api.get("/students/", {
    params: { page_size: 50, ...params },
  });
  const raw = res.data;
  const items = Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw)
      ? raw
      : [];
  const count = typeof raw?.count === "number" ? raw.count : items.length;
  return { data: items, count };
}

/** 학생 단건 */
export async function fetchStudent(studentId: number) {
  const res = await api.get(`/students/${studentId}/`);
  return res.data;
}
