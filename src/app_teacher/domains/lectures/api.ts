// PATH: src/app_teacher/domains/lectures/api.ts
// 강의/세션 API — 기존 lectures API 래핑
import api from "@/shared/api/axios";

/** 강의 목록 (활성만) */
export async function fetchLectures() {
  const res = await api.get("/lectures/lectures/", {
    params: { is_active: true, page_size: 100 },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 강의 단건 */
export async function fetchLecture(lectureId: number) {
  const res = await api.get(`/lectures/lectures/${lectureId}/`);
  return res.data;
}

/** 강의의 세션 목록 */
export async function fetchLectureSessions(lectureId: number) {
  const res = await api.get("/lectures/sessions/", {
    params: { lecture: lectureId, page_size: 100, ordering: "-date" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 세션 단건 */
export async function fetchSession(sessionId: number) {
  const res = await api.get(`/lectures/sessions/${sessionId}/`);
  return res.data;
}
