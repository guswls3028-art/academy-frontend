import api from "@/shared/api/axios";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";

export type AssessmentKind = "exam" | "homework";
export const assessmentCommentQueryKeys = {
  admin: (sessionId: number, kind: AssessmentKind, assessmentId: number) => ["parent-assessment-comments", sessionId, kind, assessmentId] as const,
  parent: (userId: number | undefined, childId: number | null) => ["student-parent-feedback", userId, childId] as const,
};
export type ParentComment = { session_id: number; assessment_kind: AssessmentKind; assessment_id: number; assessment_title?: string; session_title?: string; text: string; version: number; updated_at: string };
export type CommentRevision = { version: number; text: string; author_id: number | null; author_name: string; created_at: string };
export type AdminParentComment = { enrollment_id: number; student_id: number; student_name: string; text: string; version: number; updated_at: string | null; updated_by: number | null; history: CommentRevision[] };
const base = (sessionId: number, kind: AssessmentKind, id: number) => `/results/admin/sessions/${sessionId}/${kind}/${id}/parent-comments/`;
export async function fetchAdminParentComments(sessionId: number, kind: AssessmentKind, id: number) {
  return (await api.get<{ items: AdminParentComment[] }>(base(sessionId, kind, id))).data.items;
}
export async function saveParentComment(sessionId: number, kind: AssessmentKind, id: number, enrollmentId: number, text: string, version: number) {
  return (await api.put<AdminParentComment>(`${base(sessionId, kind, id)}${enrollmentId}/`, { text, version })).data;
}
export async function fetchParentComments() {
  const childId = getParentStudentId();
  return (await api.get<{ items: ParentComment[] }>("/results/parent/assessment-comments/", { headers: childId ? { "X-Student-Id": String(childId) } : undefined })).data.items;
}
