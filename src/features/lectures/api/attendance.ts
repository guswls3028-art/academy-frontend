// PATH: src/features/lectures/api/attendance.ts
import api from "@/shared/api/axios";
import { pollJobUntilDone, downloadFromUrl } from "@/shared/api/jobExport";

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
 * 2-1 출결 단건 삭제 (차시에서 수강생 제외)
 * DELETE /api/v1/lectures/attendance/{id}/
 * ======================================================= */
export async function deleteAttendance(id: number) {
  await api.delete(`/lectures/attendance/${id}/`);
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

/** 강의 출결 매트릭스 응답 (세션에 등록된 수강생 + 차시별 출결) */
export type AttendanceMatrixSession = {
  id: number;
  order: number | null;
  date: string | null;
};

export type AttendanceMatrixStudent = {
  student_id: number;
  name: string;
  phone: string | null;
  parent_phone: string | null;
  /** session_id 문자열 키 → { attendance_id, status } */
  attendance: Record<string, { attendance_id: number; status: string }>;
};

export type AttendanceMatrixResponse = {
  lecture: { id: number; title: string; color?: string };
  sessions: AttendanceMatrixSession[];
  students: AttendanceMatrixStudent[];
};

export async function fetchAttendanceMatrix(
  lectureId: number
): Promise<AttendanceMatrixResponse> {
  const res = await api.get("/lectures/attendance/matrix/", {
    params: { lecture: lectureId },
  });
  return res.data;
}

/* =========================================================
 * 5️⃣ 출결 엑셀 내보내기 (비동기 job → 폴링 후 다운로드)
 * POST /lectures/attendance/excel/ → job_id → GET /jobs/<id>/ 폴링 → download_url
 * ======================================================= */
export async function downloadAttendanceExcel(lectureId: number): Promise<void> {
  const res = await api.post<{ job_id: string; status: string }>(
    "/lectures/attendance/excel/",
    { lecture_id: lectureId }
  );
  const jobId = res.data?.job_id;
  if (!jobId) throw new Error("Export job could not be started.");

  const data = await pollJobUntilDone(jobId);
  const url = data.result?.download_url;
  const filename = data.result?.filename;
  if (!url) throw new Error("Export completed but no download link.");
  downloadFromUrl(url, filename || "attendance.xlsx");
}
