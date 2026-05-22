// PATH: src/app_admin/domains/exams/api/sessionEnrollments.ts
// Compatibility facade. The canonical SessionEnrollment API lives in app_admin/domains/enrollment.
import {
  fetchSessionEnrollments as fetchCanonicalSessionEnrollments,
  type SessionEnrollmentRow,
} from "@admin/domains/enrollment/api/enrollments";

export type SessionEnrollment = {
  id: number;
  session: number;
  enrollment: number;
  student_name: string;
  created_at: string;
};

function toExamSessionEnrollment(row: SessionEnrollmentRow): SessionEnrollment {
  return {
    id: row.id,
    session: row.session,
    enrollment: row.enrollment,
    student_name: row.student_name,
    created_at: row.created_at ?? "",
  };
}

export async function fetchSessionEnrollments(
  sessionId: number
): Promise<SessionEnrollment[]> {
  const rows = await fetchCanonicalSessionEnrollments(sessionId);
  return rows.map(toExamSessionEnrollment);
}
