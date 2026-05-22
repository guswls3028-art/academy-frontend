// PATH: src/shared/api/contracts/tenantInfo.ts
// Tenant information API contract

import api from "@/shared/api/axios";

/** 소속 학원(테넌트) 정보 — 설정 > 내 정보에서 학원문의(학원명·전화) 표시/수정 */
export type AcademyEntry = { name: string; phone: string };

export type TenantInfo = {
  name: string;
  phone: string;
  headquarters_phone: string;
  /** 소속 학원 목록 (여러 개 등록 가능). 비어 있으면 기존 name/headquarters_phone 단일 항목 */
  academies: AcademyEntry[];
  /** 카카오톡/SNS OG 미리보기 */
  og_title?: string;
  og_description?: string;
  og_image_url?: string;
  /** 합/불 라벨 커스텀. 빈 문자열이면 기본값(합격/불합격) 사용. */
  pass_label?: string;
  fail_label?: string;
};

export type UpdateTenantInfoPayload =
  Partial<Pick<TenantInfo, "name" | "phone" | "headquarters_phone" | "og_title" | "og_description" | "og_image_url" | "pass_label" | "fail_label">>
  & { academies?: AcademyEntry[] };

export async function fetchTenantInfo(): Promise<TenantInfo> {
  const { data } = await api.get<TenantInfo>("/core/tenant-info/");
  return data;
}

export async function updateTenantInfo(payload: UpdateTenantInfoPayload): Promise<TenantInfo> {
  const { data } = await api.patch<TenantInfo>("/core/tenant-info/", payload);
  return data;
}
