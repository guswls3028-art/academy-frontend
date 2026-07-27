// PATH: src/dev_app/api/billing.ts
// Billing admin API — 플랫폼 관리자용 결제/구독 관리

import api from "@/shared/api/axios";

// ── Types ──

export type TenantSubscriptionDto = {
  program_id?: number;
  tenant_id: number;
  tenant_code: string;
  tenant_name: string;
  plan: string;
  plan_display: string;
  monthly_price: number;
  monthly_supply_amount?: number;
  monthly_tax_amount?: number;
  monthly_total_amount?: number;
  monthly_price_includes_tax?: boolean;
  vat_rate_percent?: number | null;
  billing_price_policy?: string;
  is_contract_price?: boolean;
  has_lifetime_price_guarantee?: boolean;
  price_guarantee_code?: string | null;
  price_guarantee_label?: string | null;
  subscription_status: string;
  subscription_status_display: string;
  subscription_expires_at: string | null;
  service_access_expires_at?: string | null;
  grace_period_days?: number;
  grace_expires_at?: string | null;
  days_remaining: number | null;
  billing_mode: string;
  cancel_at_period_end: boolean;
  next_billing_at: string | null;
  is_subscription_active: boolean;
};

export type InvoiceDto = {
  id: number;
  invoice_number: string;
  tenant_code: string;
  plan: string;
  billing_mode: string;
  total_amount: number;
  supply_amount: number;
  tax_amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  status: string;
  status_display?: string;
  is_terminal?: boolean;
  can_mark_paid?: boolean;
  payment_blocked_reason?: string;
  paid_at: string | null;
  failed_at: string | null;
  attempt_count: number;
  created_at: string;
};

export type DashboardDto = {
  mrr: number;
  mrr_supply_amount?: number;
  mrr_tax_amount?: number;
  mrr_total_amount?: number;
  mrr_includes_tax?: boolean;
  vat_rate_percent?: number | null;
  status_counts: Record<string, number>;
  expiring_soon: number;
  overdue_invoices: number;
  plan_distribution: Record<string, number>;
  total_tenants: number;
};

export type BankTransferNoticeDto = {
  id: number;
  tenant_code: string;
  tenant_name: string;
  invoice: number;
  invoice_number: string;
  invoice_status: string;
  supply_amount: number;
  tax_amount: number;
  amount: number;
  due_date: string;
  depositor_name: string;
  deposited_at: string;
  status: "SUBMITTED" | "CONFIRMED" | "REJECTED";
  tax_invoice_requested: boolean;
  tax_invoice_issue_id: number | null;
  tax_invoice_status: string;
  tax_invoice_issue_number: string;
  business_profile_snapshot: {
    business_name?: string;
    representative_name?: string;
    business_registration_number?: string;
    address?: string;
    business_type?: string;
    business_item?: string;
    tax_invoice_email?: string;
    manager_name?: string;
    manager_phone?: string;
    manager_email?: string;
  };
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
};

// ── API calls ──

export async function getTenantSubscriptions(): Promise<TenantSubscriptionDto[]> {
  const res = await api.get<TenantSubscriptionDto[]>("/billing/admin/tenants/");
  return res.data;
}

export async function extendSubscription(
  programId: number,
  days: number,
): Promise<{ tenant_code: string; subscription_status: string; subscription_expires_at: string; days_remaining: number }> {
  const res = await api.post(`/billing/admin/tenants/${programId}/extend/`, { days });
  return res.data;
}

export async function getInvoices(params?: {
  status?: string;
  tenant?: string;
}): Promise<{ results: InvoiceDto[] }> {
  const res = await api.get<{ results: InvoiceDto[] }>("/billing/admin/invoices/", { params });
  return res.data;
}

export async function markInvoicePaid(invoiceId: number): Promise<InvoiceDto> {
  const res = await api.post(`/billing/admin/invoices/${invoiceId}/mark-paid/`);
  return res.data;
}

export async function getDashboard(): Promise<DashboardDto> {
  const res = await api.get<DashboardDto>("/billing/admin/dashboard/");
  return res.data;
}

export async function getBankTransferNotices(params?: {
  page?: number;
  actionable?: boolean;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: BankTransferNoticeDto[];
}> {
  const res = await api.get<{
    count: number;
    next: string | null;
    previous: string | null;
    results: BankTransferNoticeDto[];
  }>(
    "/billing/admin/bank-transfer/notices/",
    { params },
  );
  return res.data;
}

export async function confirmBankTransferNotice(
  noticeId: number,
): Promise<BankTransferNoticeDto> {
  const res = await api.post<BankTransferNoticeDto>(
    `/billing/admin/bank-transfer/notices/${noticeId}/confirm/`,
  );
  return res.data;
}

export async function rejectBankTransferNotice(
  noticeId: number,
  reason: string,
): Promise<BankTransferNoticeDto> {
  const res = await api.post<BankTransferNoticeDto>(
    `/billing/admin/bank-transfer/notices/${noticeId}/reject/`,
    { reason },
  );
  return res.data;
}

export async function markTaxInvoiceIssued(
  issueId: number,
  issueNumber: string,
): Promise<BankTransferNoticeDto> {
  const res = await api.post<BankTransferNoticeDto>(
    `/billing/admin/tax-invoices/${issueId}/mark-issued/`,
    { issue_number: issueNumber },
  );
  return res.data;
}
