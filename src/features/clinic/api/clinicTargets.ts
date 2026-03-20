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
export type ClinicTarget = {
  enrollment_id: number;
  student_name: string;
  session_title: string;

  clinic_reason?: ClinicReason;

  reason?: "score" | "confidence" | "missing"; // score=불합, confidence=신뢰도낮음, missing=미응시
  exam_score?: number;
  cutline_score?: number;

  homework_score?: number;
  homework_cutline?: number;

  created_at: string;
};

/**
 * GET /results/admin/clinic-targets/
 */
export async function fetchClinicTargets() {
  const res = await api.get("/results/admin/clinic-targets/");
  return res.data as ClinicTarget[];
}
