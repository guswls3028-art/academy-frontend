import api from "@/shared/api/axios";

export type LectureOption = { id: number; title: string };
export type OpsPreviewRow = {
  row_id: string; name: string; student_phone: string; parent_phone: string;
  school: string; school_type: "ELEMENTARY" | "MIDDLE" | "HIGH"; grade: string;
  selected_lecture_id: number | null; session_order: number | null; remove_enrollment_id: number | null;
  actions: { register_student: boolean; enroll_lecture: boolean; open_video: boolean; send_account_notice: boolean; correct_enrollment: boolean };
  student_match: { status: string; id: number | null; basis: string[] };
  profile_changes: string[]; attendance_target: "ONLINE" | null;
  correction_options: Array<{ enrollment_id: number; lecture_title: string; impact: { can_remove: boolean; session_enrollments: number; removable_unset_attendances: number } }>;
  issues: Array<{ code: string; message: string; blocking: boolean }>; can_confirm: boolean;
};
export type AnalyzeResult = { proposal_token: string; rows: OpsPreviewRow[]; lecture_options: LectureOption[]; privacy: string };
export type ExecutionResult = { execution_id: string; status?: string; idempotent_replay: boolean; provider_receipt_note?: string; rows?: Array<{ row_id: string; account_creation: string; profile_link: { state: string }; enrollment: { correct_active_count: number; wrong_active_removed: boolean }; attendance: { status: string } | null; video_access: Array<{ access_mode: string; monitoring: boolean }>; account_notice: { state: string; provider_evidence?: { accepted_count: number; expected_count: number } }; real_playback_canary: { state: string; reason?: string } }> };

export async function analyzeTeacherOps(images: File[], message: string, previous?: string) {
  const form = new FormData();
  images.forEach((image) => form.append("images", image));
  form.append("message", message);
  if (previous) form.append("previous_proposal_token", previous);
  return (await api.post<AnalyzeResult>("/teacher-app/ops-assistant/analyze/", form)).data;
}
export async function confirmTeacherOps(token: string, rows: OpsPreviewRow[]) {
  return (await api.post<ExecutionResult>("/teacher-app/ops-assistant/confirm/", { proposal_token: token, rows: rows.map((row) => ({ row_id: row.row_id, enabled: true, name: row.name, student_phone: row.student_phone, parent_phone: row.parent_phone, school: row.school, school_type: row.school_type, grade: row.grade, selected_lecture_id: row.selected_lecture_id, session_order: row.session_order, remove_enrollment_id: row.remove_enrollment_id })) })).data;
}
export async function fetchTeacherOpsExecution(id: string) {
  return (await api.get<ExecutionResult>(`/teacher-app/ops-assistant/executions/${id}/`)).data;
}
