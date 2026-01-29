// src/features/lectures/api/sessions.ts
import api from "@/shared/api/axios";

// ----------------------------------------
// LECTURE 상세 가져오기
// ----------------------------------------
export async function fetchLecture(lectureId: number) {
  const res = await api.get(`/lectures/lectures/${lectureId}/`);
  return res.data;
}

// ----------------------------------------
// SESSION 목록 가져오기 (lecture 기준)
// ----------------------------------------
export async function fetchSessions(lectureId: number) {
  const res = await api.get(`/lectures/sessions/?lecture=${lectureId}`);
  return res.data.results;
}

// ----------------------------------------
// SESSION 생성 (기존 기능 유지)
// ----------------------------------------
export async function createSession(
  lectureId: number,
  title: string,
  date: string
) {
  const res = await api.post(`/lectures/sessions/`, {
    lecture: lectureId,
    title,
    date,
  });

  return res.data;
}

/**
 * ⚠️ ATTENDANCE는 여기서 조회하지 않는다.
 * - 경로 혼재(attendance vs attendances)로 404 폭탄 방지
 * - 출결 조회/수정/일괄등록은 반드시 `api/attendance.ts`만 사용
 */
// export async function fetchAttendance(sessionId: number) { ... }  // ❌ 제거
