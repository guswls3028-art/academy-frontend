import api from "@/shared/api/axios";

/**
 * 🔹 ClinicReason
 * - backend(results)가 내려주는 판정 결과
 * - exam / homework / both
 */
export type ClinicReason = "exam" | "homework" | "both";

/**
 * ✅ ClinicTarget
 * - 시험 / 과제 기준으로 자동 선정된 클리닉 대상자
 * - backend에서 ClinicLink(is_auto=True) 단일 기준으로 생성
 *
 * ⚠️ 설계 계약
 * - 대상자 선정/판정 단일 진실은 backend(results)이다.
 * - 프론트는 계산/필터링/추론을 하지 않고 "표시"만 한다.
 * - enrollment_id 기준으로만 식별한다.
 */
export type ResolutionType =
  | "EXAM_PASS"
  | "HOMEWORK_PASS"
  | "MANUAL_OVERRIDE"
  | "WAIVED"
  | "BOOKING_LEGACY"
  | null;

export type AttemptHistoryEntry = {
  attempt_index: number;
  score: number | null;
  max_score: number | null;
  passed: boolean;
  at: string | null;
};

export type ClinicTarget = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  session_title: string;

  clinic_reason?: ClinicReason;

  reason?: "score" | "confidence" | "missing"; // score=불합, confidence=신뢰도낮음, missing=미응시
  exam_score?: number | null;
  cutline_score?: number;

  homework_score?: number;
  homework_cutline?: number;

  // ✅ V1.1.1 remediation fields
  clinic_link_id?: number;
  cycle_no?: number;
  resolution_type?: ResolutionType;
  resolved_at?: string | null;

  // ✅ V1.1.1 navigation: 시험/과제 페이지 직접 연결
  session_id?: number;
  lecture_id?: number;
  exam_id?: number | null;

  // ✅ V1.1.1 clinic retake fields
  source_type?: "exam" | "homework" | null;
  source_id?: number | null;
  source_title?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  parent_phone?: string;
  student_phone?: string;
  school?: string;
  school_type?: string;
  grade?: number | null;
  profile_photo_url?: string | null;
  max_score?: number | null;
  latest_attempt_index?: number;
  attempt_history?: AttemptHistoryEntry[];

  created_at: string;
};

export type RetakeResponse = {
  passed: boolean;
  score: number;
  max_score: number;
  attempt_index: number;
  resolution_type: ResolutionType;
  resolved_at: string | null;
  clinic_link_id: number;
};

/**
 * GET /results/admin/clinic-targets/
 */
export async function fetchClinicTargets(params?: { section_id?: number }) {
  const res = await api.get("/results/admin/clinic-targets/", { params });
  return res.data as ClinicTarget[];
}
