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
import type { Achievement } from "@/shared/scoring/achievement";
import type { ClinicRetakeInfo } from "../types/results.types";

export type OmrAnswerMeta = {
  version?: string;
  detected?: (string | number)[];
  marking?: "single" | "blank" | "multi" | string;
  confidence?: number;
  status?: "ok" | string;
  // Legacy fallback 경로 (서버 구버전에서 주입된 경우에만 사용)
  image_url?: string;
  imageUrl?: string;
  page_image_url?: string;
};

export type ManualReviewMeta = {
  required?: boolean;
  reasons?: string[];
  updated_at?: string | null;
  resolved_at?: string | null;
};

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

  /** 정답 (AnswerKey 기반, 선택형="1"~"5", 서술형=텍스트) */
  correct_answer?: string;

  meta?: {
    omr?: OmrAnswerMeta;
    [key: string]: unknown;
  };
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

  /** 정답표: key=ExamQuestion.id(string), value=정답 */
  correct_answers?: Record<string, string>;

  /** OMR 스캔 원본 presigned URL (없으면 "") */
  scan_image_url?: string;

  /** 스캔 제출 기준 submission id (manual-edit API 호출용) */
  submission_id?: number | null;

  /** Submission 상태 (answers_ready / needs_identification / failed 등) */
  submission_status?: string | null;

  /** 수동 검토 필요 여부 + 사유 */
  manual_review?: ManualReviewMeta | null;

  /** identifier_status: matched / detected / no_match / missing */
  identifier_status?: string | null;

  /**
   * ✅ 성취 SSOT (backend compute_exam_achievement 결과)
   * - passed: 1차 합격 기준(석차용).
   * - remediated: 1차 불합격 + 클리닉 해소.
   * - final_pass: 1차 OR remediated.
   * - achievement: 뱃지 분류 (PASS/REMEDIATED/FAIL/NOT_SUBMITTED).
   * - clinic_retake: 재시험 점수/해소 시각.
   * - is_provisional: 채점 미확정.
   */
  passed?: boolean | null;
  remediated?: boolean | null;
  final_pass?: boolean | null;
  achievement?: Achievement | null;
  clinic_retake?: ClinicRetakeInfo | null;
  is_provisional?: boolean;
  meta_status?: string | null;
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
