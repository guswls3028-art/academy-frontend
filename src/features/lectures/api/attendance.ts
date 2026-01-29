// src/features/lectures/api/attendance.ts
import api from "@/shared/api/axios";

/* =========================================================
 * 1️⃣ 세션 단위 출결 목록 조회 (SessionDetailPage)
 * GET /api/v1/lectures/attendance/?session={id}
 * ======================================================= */
export async function fetchAttendance(sessionId: number) {
  const res = await api.get("/lectures/attendance/", {
    params: { session: sessionId },
  });
  return Array.isArray(res.data) ? res.data : res.data.results;
}

/* =========================================================
 * 2️⃣ 출결 단건 수정 (상태 / 메모)
 * PATCH /api/v1/lectures/attendance/{id}/
 * ======================================================= */
export async function updateAttendance(
  id: number,
  payload: { status?: string; memo?: string }
) {
  const res = await api.patch(`/lectures/attendance/${id}/`, payload);
  return res.data;
}

/* =========================================================
 * 3️⃣ 세션 기준 학생 등록
 * POST /api/v1/lectures/attendance/bulk_create/
 * ======================================================= */
export async function bulkCreateAttendance(
  sessionId: number,
  studentIds: number[]
) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error("students 배열이 비어있습니다.");
  }

  const res = await api.post("/lectures/attendance/bulk_create/", {
    session: sessionId,
    students: studentIds,
  });
  return res.data;
}

/* =========================================================
 * 4️⃣ 강의 × 차시 출결 매트릭스
 * GET /api/v1/lectures/attendance/matrix/?lecture={id}
 * ======================================================= */
export async function fetchAttendanceMatrix(lectureId: number) {
  const res = await api.get("/lectures/attendance/matrix/", {
    params: { lecture: lectureId },
  });
  return res.data;
}

/* =========================================================
 * 5️⃣ 출결 엑셀 다운로드
 * ======================================================= */
export function downloadAttendanceExcel(lectureId: number) {
  window.location.href =
    `/api/v1/lectures/attendance/excel/?lecture=${lectureId}`;
}
