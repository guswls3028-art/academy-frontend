// PATH: src/app_admin/domains/students/api/enrollmentMatrix.api.ts
// 학생 단위 enrollment matrix API wrapper (Phase #11/#12, 2026-05-12).

import api from "@/shared/api/axios";

export interface MatrixExam { id: number; title: string; enrolled: boolean }
export interface MatrixHomework { id: number; title: string; enrolled: boolean }
export interface MatrixSession {
  id: number;
  title: string;
  order: number;
  session_type?: string | null;
  regular_order?: number | null;
  display_label?: string | null;
  session_enrolled: boolean;
  exams: MatrixExam[];
  homeworks: MatrixHomework[];
}

export interface StudentEnrollmentMatrix {
  enrollment_id: number | null;
  lecture: { id: number; title: string };
  student?: { id: number; name: string };
  sessions: MatrixSession[];
  detail?: string;
}

export async function fetchStudentEnrollmentMatrix(studentId: number, lectureId: number): Promise<StudentEnrollmentMatrix> {
  const { data } = await api.get<StudentEnrollmentMatrix>(
    `/students/${studentId}/enrollment-matrix/`,
    { params: { lecture_id: lectureId } },
  );
  return data;
}

export type MatrixToggleTarget = "session" | "exam" | "homework";
export type MatrixToggleAction = "add" | "remove";

export async function toggleStudentEnrollmentMatrix(payload: {
  student_id: number;
  lecture_id: number;
  target_type: MatrixToggleTarget;
  target_id: number;
  action: MatrixToggleAction;
}): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    `/students/${payload.student_id}/enrollment-matrix/toggle/`,
    {
      lecture_id: payload.lecture_id,
      target_type: payload.target_type,
      target_id: payload.target_id,
      action: payload.action,
    },
  );
  return data;
}
