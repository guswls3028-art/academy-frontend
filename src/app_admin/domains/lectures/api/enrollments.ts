// PATH: src/app_admin/domains/lectures/api/enrollments.ts
import api from "@/shared/api/axios";

export type LectureEnrollmentStudent = {
  id: number | null;
  name: string | null;
  grade?: number | null;
  high_school?: string | null;
  middle_school?: string | null;
  elementary_school?: string | null;
  profile_photo_url?: string | null;
  name_highlight_clinic_target?: boolean;
};

export type LectureEnrollmentRow = {
  id?: number | null;
  status?: string | null;
  student?: LectureEnrollmentStudent | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return [];
}

function normalizeLectureEnrollment(raw: unknown): LectureEnrollmentRow {
  const record = asRecord(raw);
  const student = asRecord(record.student);
  return {
    id: asNullableNumber(record.id),
    status: asNullableString(record.status),
    student: Object.keys(student).length > 0
      ? {
          id: asNullableNumber(student.id),
          name: asNullableString(student.name),
          grade: asNullableNumber(student.grade),
          high_school: asNullableString(student.high_school),
          middle_school: asNullableString(student.middle_school),
          elementary_school: asNullableString(student.elementary_school),
          profile_photo_url: asNullableString(student.profile_photo_url),
          name_highlight_clinic_target: student.name_highlight_clinic_target === true,
        }
      : null,
  };
}

export async function fetchLectureEnrollments(lectureId: number): Promise<LectureEnrollmentRow[]> {
  const res = await api.get("/enrollments/", {
    params: { lecture: lectureId },
  });
  return unwrapList(res.data).map(normalizeLectureEnrollment);
}

export async function bulkCreateEnrollments(
  lectureId: number,
  studentIds: number[]
) {
  const res = await api.post("/enrollments/bulk_create/", {
    lecture: lectureId,
    students: studentIds,
  });
  return res.data;
}

/**
 * 강의/차시 엑셀 수강등록 — 워커 전담. 기존·신규 동일 로직.
 * API는 파일 수신 → R2 업로드 → SQS job 등록만 하며, 파싱·등록은 워커에서 수행.
 * sessionId 있으면 해당 차시에만 등록, 없으면 1차시 생성·등록.
 */
export async function lectureEnrollFromExcelUpload(
  lectureId: number,
  file: File,
  initialPassword: string,
  options?: { sessionId?: number }
) {
  const form = new FormData();
  form.append("file", file);
  form.append("lecture_id", String(lectureId));
  form.append("initial_password", initialPassword);
  if (options?.sessionId != null) {
    form.append("session_id", String(options.sessionId));
  }
  const res = await api.post("/enrollments/lecture_enroll_from_excel/", form);
  return res.data as { job_id: string; status: string };
}

/** 엑셀 수강등록 job 상태 (폴링용) */
export type ExcelEnrollJobStatus = {
  job_id: string;
  status: string;
  result?: {
    enrolled_count: number;
    created_students_count?: number;
    session_id?: number;
    processed_by?: string;
  };
  error_message?: string | null;
  progress?: { step?: string; percent?: number } | null;
};

export async function getExcelEnrollJobStatus(
  jobId: string
): Promise<ExcelEnrollJobStatus> {
  const res = await api.get(
    `/enrollments/excel_job_status/${encodeURIComponent(jobId)}/`
  );
  return res.data as ExcelEnrollJobStatus;
}

// ========== 차시(세션) 수강생 (SessionEnrollment) ==========

export type SessionEnrollmentRow = {
  id: number;
  session: number;
  enrollment: number;
  student_id?: number;
  student_name: string;
  /** 동명이인 식별용 — backend serializer가 high/middle/elementary 중 하나 합성. */
  student_school?: string | null;
  student_grade?: number | null;
  created_at?: string;
};

/** 해당 차시에 등록된 수강생 목록 */
export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollmentRow[]> {
  const res = await api.get("/enrollments/session-enrollments/", {
    params: { session: sessionId },
  });
  const list = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  return list;
}

/** 차시에 수강생(Enrollment) 일괄 등록 */
export async function bulkCreateSessionEnrollments(
  sessionId: number,
  enrollmentIds: number[]
) {
  const res = await api.post("/enrollments/session-enrollments/bulk_create/", {
    session: sessionId,
    enrollments: enrollmentIds,
  });
  return res.data;
}
