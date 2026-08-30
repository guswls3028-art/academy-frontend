import api from "@/shared/api/axios";
import type { components } from "@/shared/api/generated/schema";

export type DirectVideoEntitlement = components["schemas"]["DirectVideoEntitlement"];
export type DirectVideoEntitlementMutation = components["schemas"]["DirectVideoEntitlementMutation"];
export type DirectVideoGrantRequest = components["schemas"]["DirectVideoEntitlementGrantRequest"];

type DirectVideoEntitlementList = components["schemas"]["PaginatedDirectVideoEntitlementList"];

export async function fetchDirectVideoEntitlements(
  videoId: number,
): Promise<DirectVideoEntitlement[]> {
  const response = await api.get<DirectVideoEntitlementList>(
    "/media/direct-video-entitlements/",
    { params: { video_id: videoId, page_size: 100 } },
  );
  return Array.isArray(response.data?.results) ? response.data.results : [];
}

export async function grantDirectVideoEntitlement(
  payload: DirectVideoGrantRequest,
): Promise<DirectVideoEntitlementMutation> {
  const response = await api.post<DirectVideoEntitlementMutation>(
    "/media/direct-video-entitlements/",
    payload,
  );
  return response.data;
}

export async function revokeDirectVideoEntitlement(
  entitlementId: number,
  reason: string,
): Promise<DirectVideoEntitlementMutation> {
  const response = await api.post<DirectVideoEntitlementMutation>(
    `/media/direct-video-entitlements/${entitlementId}/revoke/`,
    { reason },
  );
  return response.data;
}

const DIRECT_VIDEO_ERROR_MESSAGES: Record<string, string> = {
  account_inactive: "로그인 가능한 학생 계정만 선택할 수 있습니다.",
  actor_forbidden: "영상 권한을 관리할 교직원 권한이 없습니다.",
  enrollment_exists: "이 강의에 수강 등록 이력이 있어 기존 수강 경로를 사용해야 합니다.",
  lecture_inactive: "종료되거나 비활성인 강의에는 개별 영상 권한을 열 수 없습니다.",
  regrant_confirmation_required: "이전에 회수한 권한입니다. 다시 승인하려면 새 확인이 필요합니다.",
  student_not_found: "현재 학원에서 사용할 수 있는 학생을 찾지 못했습니다.",
  video_already_public: "전체 공개 영상에는 개별 권한이 필요하지 않습니다.",
  video_not_found: "현재 학원의 영상을 찾지 못했습니다.",
  video_not_ready: "재생 준비가 끝난 영상만 권한을 열 수 있습니다.",
  video_source_unsupported: "YouTube 영상은 개별 권한으로 열 수 없습니다.",
};

export function directVideoAccessErrorMessage(error: unknown): string {
  const response = (error as {
    response?: { data?: { code?: unknown; detail?: unknown } };
  } | null)?.response;
  const code = typeof response?.data?.code === "string" ? response.data.code : "";
  if (code && DIRECT_VIDEO_ERROR_MESSAGES[code]) return DIRECT_VIDEO_ERROR_MESSAGES[code];
  if (typeof response?.data?.detail === "string" && response.data.detail.trim()) {
    return response.data.detail;
  }
  return "개별 영상 권한을 변경하지 못했습니다. 다시 확인해 주세요.";
}
