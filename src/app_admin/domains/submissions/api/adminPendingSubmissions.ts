// PATH: src/app_admin/domains/submissions/api/adminPendingSubmissions.ts
import api from "@/shared/api/axios";
import type { SubmissionStatus } from "../types";

export type PendingSubmissionRow = {
  id: number;
  enrollment_id: number;
  student_name: string;
  profile_photo_url?: string | null;
  target_type: "exam" | "homework";
  target_id: number;
  target_title: string;
  /** Exam/Homework가 살아있고 세션 매칭이 가능한 경우만 채워짐 */
  lecture_id: number | null;
  lecture_title: string;
  session_id: number | null;
  /** 백엔드 신규 필드. true 가 아니면 결과/세션 페이지 이동이 불가능함 */
  target_resolved?: boolean;
  /** target_resolved=false 일 때 사유: 'target_missing' | 'session_missing' | null */
  target_resolved_reason?: "target_missing" | "session_missing" | null;
  source: string;
  status: SubmissionStatus;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
};

export async function fetchPendingSubmissions(filter?: string): Promise<PendingSubmissionRow[]> {
  const params = filter ? { filter } : {};
  const res = await api.get("/submissions/submissions/pending/", { params });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}
