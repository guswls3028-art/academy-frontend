// PATH: src/app_admin/domains/settings/api/billing.api.ts
// 결제 카드 관리 API — Toss Payments 빌링키 등록/삭제, 결제 프로필 관리

import api from "@/shared/api/axios";

// ── Types ──

export type BillingCard = {
  id: number;
  card_company: string;
  card_number_masked: string;
  is_active: boolean;
  created_at: string;
};

export type BillingProfile = {
  payer_name: string;
  payer_email: string;
  payer_phone: string;
};

export type BillingProfileUpdate = Partial<BillingProfile>;

export type CardRegistrationParams = {
  customerKey: string;
  clientKey: string;
  successUrl: string;
  failUrl: string;
};

// ── API Functions ──

/** 등록된 카드 목록 조회 */
export async function fetchCards(): Promise<BillingCard[]> {
  const res = await api.get<BillingCard[]>("/billing/cards/");
  return res.data;
}

/** 카드 삭제 */
export async function deleteCard(id: number): Promise<void> {
  await api.delete(`/billing/cards/${id}/`);
}

/** 결제 프로필 조회 */
export async function fetchBillingProfile(): Promise<BillingProfile> {
  const res = await api.get<BillingProfile>("/billing/profile/");
  return res.data;
}

/** 결제 프로필 수정 */
export async function updateBillingProfile(
  data: BillingProfileUpdate,
): Promise<BillingProfile> {
  const res = await api.patch<BillingProfile>("/billing/profile/", data);
  return res.data;
}

/** 카드 등록 준비 — Toss SDK 초기화에 필요한 파라미터 반환 */
export async function prepareCardRegistration(): Promise<CardRegistrationParams> {
  const res = await api.post<CardRegistrationParams>(
    "/billing/card/register/prepare/",
  );
  return res.data;
}

/** 카드 등록 콜백 처리 — Toss 리다이렉트 후 authKey 전달 */
export async function processCardCallback(params: {
  authKey: string;
  customerKey: string;
}): Promise<{ id: number; card_company: string; card_number_masked: string; message: string }> {
  const res = await api.post("/billing/card/register/callback/", {
    authKey: params.authKey,
  });
  return res.data;
}
