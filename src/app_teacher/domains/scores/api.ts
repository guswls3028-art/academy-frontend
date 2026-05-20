// PATH: src/app_teacher/domains/scores/api.ts
// 성적 API — admin endpoint(권한: IsTeacherOrAdmin)를 재사용해 enrollment 기반 schema 통일
import api from "@/shared/api/axios";
import { listFromApiResponse } from "@/shared/api/response";

export type TeacherSessionExam = {
  id: number;
  title: string;
  subject?: string | null;
  max_score?: number | null;
  pass_score?: number | null;
};

export type TeacherExamResultRow = {
  id?: number;
  enrollment?: number | null;
  enrollment_id?: number | null;
  student_name?: string | null;
  student?: { name?: string | null } | null;
  exam_score?: number | null;
  final_score?: number | null;
  total_score?: number | null;
  exam_max_score?: number | null;
  max_score?: number | null;
  passed?: boolean | null;
  is_pass?: boolean | null;
  final_pass?: boolean | null;
  achievement?: string | null;
  rank?: number | null;
  enrollment_name?: string | null;
  submitted_at?: string | null;
  meta_status?: string | null;
  is_provisional?: boolean | null;
};

/** 세션에 연결된 시험 목록 (backend 필터: session_id) */
export async function fetchSessionExams(sessionId: number): Promise<TeacherSessionExam[]> {
  const res = await api.get("/exams/", { params: { session_id: sessionId, page_size: 50 } });
  return listFromApiResponse<TeacherSessionExam>(res.data);
}

/**
 * 시험별 결과(성적) — admin endpoint 사용.
 * 응답 row schema: enrollment_id / student_name / exam_score / exam_max_score / final_score /
 *                 passed / achievement / final_pass / rank / percentile / cohort_avg ...
 */
export async function fetchExamResults(examId: number): Promise<TeacherExamResultRow[]> {
  const res = await api.get(`/results/admin/exams/${examId}/results/`, { params: { page_size: 200 } });
  return listFromApiResponse<TeacherExamResultRow>(res.data);
}

/**
 * 결과 단건 수정 — 합산 점수 수동 입력 quick-patch.
 * Result row가 없으면 백엔드가 자동 생성.
 */
export async function updateResult(
  examId: number,
  enrollmentId: number,
  payload: { score: number | null; maxScore?: number | null },
): Promise<unknown> {
  const body: Record<string, unknown> = {
    score: payload.score,
    max_score: payload.maxScore ?? null,
  };
  const res = await api.patch(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/score/`,
    body,
  );
  return res.data;
}
