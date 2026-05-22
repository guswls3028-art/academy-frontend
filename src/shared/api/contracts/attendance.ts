// PATH: src/shared/api/contracts/attendance.ts
import api from "@/shared/api/axios";
import { pollJobUntilDone, downloadFromUrl } from "@/shared/api/jobExport";

/* =========================================================
 * 1️⃣ 세션 단위 출결 목록 조회 (SessionDetailPage)
 * GET /api/v1/lectures/attendance/?session={id}&page=1&page_size=50
 * 응답: { count, next, previous, results } (DRF 페이지네이션)
 * ======================================================= */
export type AttendanceRow = {
  id: number;
  status: string;
  name?: string | null;
  phone?: string | null;
  student_phone?: string | null;
  parent_phone?: string | null;
  profile_photo_url?: string | null;
  student_name?: string | null;
  student_id?: number | null;
  enrollment_id?: number | null;
  enrollment?: {
    student_id?: number | null;
  } | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean | null;
};

export type AttendanceListResponse = {
  data: AttendanceListItem[];
  count: number;
  pageSize: number;
};

export type AttendanceListItem = Record<string, unknown> & {
  id: number;
  status: string;
  name?: string | null;
  student_name?: string | null;
  phone?: string | null;
  student_phone?: string | null;
  parent_phone?: string | null;
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  student_id?: number | null;
  enrollment?: {
    student_id?: number | null;
  } | null;
};

export async function fetchAttendance(
  sessionId: number,
  options?: { page?: number; page_size?: number; search?: string; status?: string }
): Promise<AttendanceListResponse> {
  const params: Record<string, string | number> = { session: sessionId };
  if (options?.page != null) params.page = options.page;
  if (options?.page_size != null) params.page_size = options.page_size;
  if (options?.search?.trim()) params.search = options.search.trim();
  if (options?.status?.trim()) params.status = options.status.trim();

  const res = await api.get("/lectures/attendance/", { params });

  const raw = res.data as unknown;
  const record = raw != null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const items = Array.isArray(record.results)
    ? record.results as AttendanceListItem[]
    : Array.isArray(raw)
      ? raw as AttendanceListItem[]
      : [];
  const count = typeof record.count === "number" ? record.count : items.length;
  const pageSize = typeof record.page_size === "number" ? record.page_size : 50;

  return {
    data: items,
    count,
    pageSize,
  };
}

/** 세션에 이미 출결 등록된 학생 ID 목록 전체 조회 (수강생 등록 모달에서 중복 제외용, 페이지네이션 전부 수집) */
export async function fetchAttendanceEnrolledStudentIds(
  sessionId: number
): Promise<number[]> {
  const studentIds: number[] = [];
  let page = 1;
  const pageSize = 500;
  const MAX_PAGES = 100; // 안전 한계: 최대 50,000명
  while (page <= MAX_PAGES) {
    const res = await fetchAttendance(sessionId, { page, page_size: pageSize });
    const items = res.data ?? [];
    if (items.length === 0) break;
    for (const row of items) {
      const sid = row?.student_id ?? row?.enrollment?.student_id;
      if (typeof sid === "number" && Number.isFinite(sid)) studentIds.push(sid);
    }
    const count = res.count ?? 0;
    if (items.length < pageSize || studentIds.length >= count) break;
    page += 1;
  }
  return studentIds;
}

/* =========================================================
 * 2️⃣ 출결 단건 수정 (상태 / 메모)
 * PATCH /api/v1/lectures/attendance/{id}/
 * ======================================================= */
export async function updateAttendance(
  id: number,
  payload: { status?: string; memo?: string; confirm_secession?: boolean }
) {
  // SECESSION 전환은 백엔드가 confirm_secession 플래그를 요구함.
  const body =
    payload.status === "SECESSION" && payload.confirm_secession === undefined
      ? { ...payload, confirm_secession: true }
      : payload;
  const res = await api.patch(`/lectures/attendance/${id}/`, body);
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
 * 2-2 전체 현장 출석 (세션 내 모든 출결 → PRESENT)
 * POST /api/v1/lectures/attendance/bulk_set_present/
 * ======================================================= */
export async function bulkSetPresent(sessionId: number) {
  const res = await api.post("/lectures/attendance/bulk_set_present/", {
    session: sessionId,
  });
  return res.data as { updated: number; session: number };
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
  /** 있으면 표시용 (숫자-only 레거시 제목 등) */
  title?: string | null;
};

export type AttendanceMatrixStudent = {
  student_id: number;
  name: string;
  phone: string | null;
  parent_phone: string | null;
  profile_photo_url?: string | null;
  name_highlight_clinic_target?: boolean;
  /** session_id 문자열 키 → { attendance_id, status } */
  attendance: Record<string, AttendanceMatrixCell>;
};

export type AttendanceMatrixCell = {
  attendance_id: number;
  status: string;
};

export type AttendanceMatrixResponse = {
  lecture: { id: number; title: string; color?: string | null; chip_label?: string | null };
  sessions: AttendanceMatrixSession[];
  students: AttendanceMatrixStudent[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeMatrixSession(value: unknown): AttendanceMatrixSession | null {
  if (!isRecord(value)) return null;
  const id = toNumber(value.id);
  if (id == null) return null;
  return {
    id,
    order: toNumber(value.order),
    date: toStringOrNull(value.date),
    title: toStringOrNull(value.title),
  };
}

function normalizeMatrixCell(value: unknown): AttendanceMatrixCell | null {
  if (!isRecord(value)) return null;
  const status = toStringOrNull(value.status);
  if (!status) return null;
  return {
    attendance_id: toNumber(value.attendance_id) ?? 0,
    status,
  };
}

function normalizeMatrixAttendance(value: unknown): Record<string, AttendanceMatrixCell> {
  if (!isRecord(value)) return {};
  const result: Record<string, AttendanceMatrixCell> = {};
  for (const [sessionId, cellValue] of Object.entries(value)) {
    const cell = normalizeMatrixCell(cellValue);
    if (cell) result[sessionId] = cell;
  }
  return result;
}

function normalizeMatrixStudent(value: unknown): AttendanceMatrixStudent | null {
  if (!isRecord(value)) return null;
  const studentId = toNumber(value.student_id);
  if (studentId == null) return null;
  return {
    student_id: studentId,
    name: toStringOrNull(value.name) ?? "",
    phone: toStringOrNull(value.phone),
    parent_phone: toStringOrNull(value.parent_phone),
    profile_photo_url: toStringOrNull(value.profile_photo_url),
    name_highlight_clinic_target: value.name_highlight_clinic_target === true,
    attendance: normalizeMatrixAttendance(value.attendance),
  };
}

function normalizeMatrixLecture(value: unknown, fallbackId: number) {
  if (!isRecord(value)) {
    return { id: fallbackId, title: "", color: null, chip_label: null };
  }
  return {
    id: toNumber(value.id) ?? fallbackId,
    title: toStringOrNull(value.title) ?? "",
    color: toStringOrNull(value.color),
    chip_label: toStringOrNull(value.chip_label),
  };
}

export async function fetchAttendanceMatrix(
  lectureId: number
): Promise<AttendanceMatrixResponse> {
  const res = await api.get("/lectures/attendance/matrix/", {
    params: { lecture: lectureId },
  });
  const raw = isRecord(res.data) ? res.data : {};
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map(normalizeMatrixSession).filter((item): item is AttendanceMatrixSession => item != null)
    : [];
  const students = Array.isArray(raw.students)
    ? raw.students.map(normalizeMatrixStudent).filter((item): item is AttendanceMatrixStudent => item != null)
    : [];

  return {
    lecture: normalizeMatrixLecture(raw.lecture, lectureId),
    sessions,
    students,
  };
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
