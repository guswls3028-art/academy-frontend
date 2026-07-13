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
  vat_rate_percent?: number;
  billing_price_policy?: string;
  is_contract_price?: boolean;
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
  vat_rate_percent?: number;
  status_counts: Record<string, number>;
  expiring_soon: number;
  overdue_invoices: number;
  plan_distribution: Record<string, number>;
  total_tenants: number;
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

export async function changePlan(
  programId: number,
  plan: string,
): Promise<{
  tenant_code: string;
  plan: string;
  plan_display: string;
  monthly_price: number;
  monthly_supply_amount: number;
  monthly_tax_amount: number;
  monthly_total_amount: number;
  monthly_price_includes_tax: boolean;
  vat_rate_percent: number;
  billing_price_policy: string;
  is_contract_price: boolean;
}> {
  const res = await api.post(`/billing/admin/tenants/${programId}/change-plan/`, { plan });
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
