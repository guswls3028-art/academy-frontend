/**
 * PATH: src/features/results/api/adminExamResultDetail.ts
 *
 * ✅ Admin Exam Result Detail API (Phase 4 - A1)
 *
 * 변경 요약:
 * - edit_state 필드 명시적 포함 (optional ❌)
 * - 문항 단위 is_editable backend flag 반영
 *
 * ⚠️ 규칙:
 * - edit_state 누락 시 프론트는 편집 불가 처리
 */

import api from "@/shared/api/axios";
import type { EditState } from "../types/editState";

export type ExamResultItem = {
  question_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;

  /**
   * ✅ backend 책임
   * - 주관식/객관식 판단 ❌
   * - 프론트는 이 값만 신뢰
   */
  is_editable: boolean;

  meta?: any;
};

export type ExamResultDetail = {
  target_type: "exam";
  target_id: number;
  enrollment_id: number;

  attempt_id: number | null;

  total_score: number;
  max_score: number;
  submitted_at: string | null;

  items: ExamResultItem[];

  /**
   * 🔒 Phase 4 핵심
   * - 반드시 존재해야 함
   * - 없으면 프론트는 Fail Closed
   */
  edit_state: EditState;
};

export async function fetchAdminExamResultDetail(
  examId: number,
  enrollmentId: number
): Promise<ExamResultDetail> {
  const res = await api.get(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/`
  );
  return res.data;
}
