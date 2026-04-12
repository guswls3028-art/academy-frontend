/**
 * PATH: src/features/clinic/api/clinicLinks.api.ts
 * ClinicLink (remediation case) CRUD & resolution actions
 */
import api from "@/shared/api/axios";
import type { ResolutionType, RetakeResponse } from "./clinicTargets";

export type ClinicLink = {
  id: number;
  enrollment_id: number;
  session: number;
  session_title: string;
  lecture_title: string;
  student_name: string;
  reason: string;
  is_auto: boolean;
  approved: boolean;
  resolved_at: string | null;
  resolution_type: ResolutionType;
  resolution_evidence: Record<string, unknown> | null;
  cycle_no: number;
  memo: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/**
 * GET /progress/clinic-links/
 */
export async function fetchClinicLinks(params?: Record<string, string | number | boolean>) {
  const res = await api.get("/progress/clinic-links/", { params });
  return res.data as ClinicLink[];
}

/**
 * POST /progress/clinic-links/{id}/resolve/
 * 관리자 수동 통과
 */
export async function resolveClinicLink(id: number, memo?: string) {
  const res = await api.post(`/progress/clinic-links/${id}/resolve/`, { memo });
  return res.data as ClinicLink;
}

/**
 * POST /progress/clinic-links/{id}/waive/
 * 면제 처리
 */
export async function waiveClinicLink(id: number, memo?: string) {
  const res = await api.post(`/progress/clinic-links/${id}/waive/`, { memo });
  return res.data as ClinicLink;
}

/**
 * POST /progress/clinic-links/{id}/carry-over/
 * 다음 cycle 이월
 */
export async function carryOverClinicLink(id: number) {
  const res = await api.post(`/progress/clinic-links/${id}/carry-over/`);
  return res.data as ClinicLink;
}

/**
 * POST /progress/clinic-links/{id}/unresolve/
 * 통과 취소
 */
export async function unresolveClinicLink(id: number) {
  const res = await api.post(`/progress/clinic-links/${id}/unresolve/`);
  return res.data as ClinicLink;
}

/**
 * POST /progress/clinic-links/{id}/submit-retake/
 * 클리닉 재시도 점수 입력 (새 시도 추가)
 */
export async function submitClinicRetake(
  id: number,
  payload: { score: number; max_score?: number },
) {
  const res = await api.post(
    `/progress/clinic-links/${id}/submit-retake/`,
    payload,
  );
  return res.data as RetakeResponse;
}

/**
 * POST /progress/clinic-links/{id}/update-retake/
 * 기존 재시도(2차+)의 점수 수정
 */
export async function updateClinicRetake(
  id: number,
  payload: { attempt_index: number; score: number; max_score?: number },
) {
  const res = await api.post(
    `/progress/clinic-links/${id}/update-retake/`,
    payload,
  );
  return res.data as RetakeResponse;
}
