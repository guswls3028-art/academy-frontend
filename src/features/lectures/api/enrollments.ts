// PATH: src/features/lectures/api/enrollments.ts
import api from "@/shared/api/axios";

export async function fetchLectureEnrollments(lectureId: number) {
  const res = await api.get("/enrollments/", {
    params: { lecture: lectureId },
  });
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
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

// ========== 차시(세션) 수강생 (SessionEnrollment) ==========

export type SessionEnrollmentRow = {
  id: number;
  session: number;
  enrollment: number;
  student_name: string;
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
