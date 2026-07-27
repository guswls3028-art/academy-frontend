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

export type BusinessProfile = {
  id: number | null;
  business_name: string;
  representative_name: string;
  business_registration_number: string;
  address: string;
  business_type: string;
  business_item: string;
  tax_invoice_email: string;
  manager_name: string;
  manager_phone: string;
  manager_email: string;
};

export type BankTransferNotice = {
  id: number;
  invoice: number;
  invoice_number: string;
  invoice_status: string;
  amount: number;
  supply_amount: number;
  tax_amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  depositor_name: string;
  deposited_at: string;
  status: "SUBMITTED" | "CONFIRMED" | "REJECTED";
  tax_invoice_requested: boolean;
  tax_invoice_issue_id: number | null;
  tax_invoice_status: "NOT_REQUESTED" | "REQUESTED" | "READY" | "ISSUED" | "FAILED";
  tax_invoice_issue_number: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
};

export type BankTransferInvoice = {
  id: number;
  invoice_number: string;
  billing_mode: string;
  total_amount: number;
  supply_amount: number;
  tax_amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  status: string;
  status_display: string;
  bank_transfer_notice: BankTransferNotice | null;
};

export type BankTransferSummary = {
  bank_account: {
    enabled: boolean;
    bank_name: string;
    account_number: string;
    account_holder: string;
  };
  billing_mode: string;
  business_profile: BusinessProfile | null;
  invoices: BankTransferInvoice[];
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

export async function fetchBankTransferSummary(): Promise<BankTransferSummary> {
  const res = await api.get<BankTransferSummary>("/billing/bank-transfer/");
  return res.data;
}

export async function activateBankTransfer(): Promise<BankTransferSummary> {
  const res = await api.post<BankTransferSummary>(
    "/billing/bank-transfer/activate/",
  );
  return res.data;
}

export async function saveBusinessProfile(
  data: Omit<BusinessProfile, "id">,
): Promise<BusinessProfile> {
  const res = await api.patch<BusinessProfile>(
    "/billing/business-profile/",
    data,
  );
  return res.data;
}

export async function submitBankTransferNotice(data: {
  invoice_id: number;
  depositor_name: string;
  deposited_at: string;
  tax_invoice_requested: boolean;
}): Promise<BankTransferNotice> {
  const res = await api.post<BankTransferNotice>(
    "/billing/bank-transfer/notices/",
    data,
  );
  return res.data;
}
