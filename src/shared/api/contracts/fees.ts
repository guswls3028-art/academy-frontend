// PATH: src/shared/api/contracts/fees.ts
// 수납(Fees) API contract

import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

/* ────────── Types ────────── */

export type FeeType = "TUITION" | "TEXTBOOK" | "HANDOUT" | "REGISTRATION" | "MATERIAL" | "OTHER";
export type BillingCycle = "MONTHLY" | "ONE_TIME";
export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "CASH" | "OTHER";

export interface FeeTemplate {
  id: number;
  name: string;
  fee_type: FeeType;
  fee_type_display: string;
  billing_cycle: BillingCycle;
  billing_cycle_display: string;
  amount: number;
  lecture: number | null;
  lecture_title: string | null;
  auto_assign: boolean;
  is_active: boolean;
  memo: string;
  created_at: string;
  updated_at: string;
}

export interface StudentFee {
  id: number;
  student: number;
  student_name: string;
  fee_template: number;
  fee_template_name: string;
  fee_type: FeeType;
  enrollment: number | null;
  lecture_title: string | null;
  adjusted_amount: number | null;
  discount_amount: number;
  discount_reason: string;
  billing_start_month: string;
  billing_end_month: string;
  effective_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  description: string;
  amount: number;
  fee_template: number | null;
}

export interface FeePayment {
  id: number;
  invoice: number;
  invoice_number: string;
  student: number;
  student_name: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_method_display: string;
  status: string;
  status_display: string;
  paid_at: string;
  recorded_by: number | null;
  receipt_note: string;
  memo: string;
  created_at: string;
}

export interface StudentInvoice {
  id: number;
  invoice_number: string;
  student: number;
  student_name: string;
  student_phone?: string | null;
  student_parent_phone?: string | null;
  billing_year: number;
  billing_month: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: InvoiceStatus;
  status_display: string;
  due_date: string;
  paid_at: string | null;
  memo: string;
  created_at: string;
  items?: InvoiceItem[];
  payments?: FeePayment[];
}

export interface FeeTypeStat {
  fee_type: FeeType;
  total: number;
}

export interface DashboardStats {
  billing_year: number;
  billing_month: number;
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  overdue_count: number;
  pending_count: number;
  paid_count: number;
  invoice_count: number;
  by_fee_type: FeeTypeStat[];
}

/* ────────── API: Lectures (for filters) ────────── */

export interface LectureOption {
  id: number;
  title: string;
}

export async function fetchLectureOptions(): Promise<LectureOption[]> {
  return (await fetchFeePages<LectureOption>("/lectures/lectures/", { is_active: true }))
    .map(normalizeLectureOption)
    .filter((option): option is LectureOption => option != null);
}

/* ────────── helpers ────────── */

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function fetchFeePages<T extends { id: number }>(path: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 조회해 주세요.");
  const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
  const rows: T[] = [];
  const ids = new Set<number>();
  let expectedCount: number | undefined;
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<T[] | { results: T[]; count: number; next: string | null }>(path, {
      ...config, params: { ...params, page, page_size: 500 },
    });
    const items = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(items) || (page > 1 && Array.isArray(data))) throw new Error("목록 응답을 확인하지 못했습니다. 다시 조회해 주세요.");
    const count = Array.isArray(data) ? undefined : data.count;
    const next = Array.isArray(data) ? null : data.next;
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error("목록 건수가 올바르지 않습니다. 다시 조회해 주세요.");
    if (next != null && (typeof next !== "string" || !next)) throw new Error("다음 페이지 정보가 올바르지 않습니다. 다시 조회해 주세요.");
    if (page === 1) expectedCount = count;
    else if (count !== expectedCount) throw new Error("조회 중 목록이 변경되었습니다. 다시 조회해 주세요.");
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) throw new Error("중복되거나 잘못된 목록입니다. 다시 조회해 주세요.");
      ids.add(item.id);
      rows.push(item);
    }
    if (!next) {
      if (expectedCount !== undefined && rows.length !== expectedCount) throw new Error("목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
      return rows;
    }
    if (!items.length || expectedCount === undefined || rows.length >= expectedCount) throw new Error("목록 전체를 불러오지 못했습니다. 다시 조회해 주세요.");
    // Rebuild the same scoped request; never follow an API-provided next URL.
  }
}

function normalizeLectureOption(value: unknown): LectureOption | null {
  const record = asRecord(value);
  const id = Number(record.id);
  const title = typeof record.title === "string" ? record.title : "";
  if (!Number.isFinite(id) || id <= 0 || !title) return null;
  return { id, title };
}

/* ────────── API: Fee Templates ────────── */

export async function fetchFeeTemplates(params?: Record<string, string>) {
  return fetchFeePages<FeeTemplate>("/fees/templates/", params);
}

export async function createFeeTemplate(data: Partial<FeeTemplate>) {
  const res = await api.post<FeeTemplate>("/fees/templates/", data);
  return res.data;
}

export async function updateFeeTemplate(id: number, data: Partial<FeeTemplate>) {
  const res = await api.patch<FeeTemplate>(`/fees/templates/${id}/`, data);
  return res.data;
}

export async function deleteFeeTemplate(id: number) {
  await api.delete(`/fees/templates/${id}/`);
}

/* ────────── API: Student Fees ────────── */

export async function fetchStudentFees(params?: Record<string, string>) {
  return fetchFeePages<StudentFee>("/fees/student-fees/", params);
}

export async function createStudentFee(data: { student: number; fee_template: number; enrollment?: number }) {
  const res = await api.post<StudentFee>("/fees/student-fees/", data);
  return res.data;
}

export async function bulkAssignStudentFees(data: { student_ids: number[]; fee_template_id: number }) {
  const res = await api.post<{ created: number; skipped: number; total: number }>(
    "/fees/student-fees/bulk-assign/",
    data,
  );
  return res.data;
}

export async function deleteStudentFee(id: number) {
  await api.delete(`/fees/student-fees/${id}/`);
}

/* ────────── API: Invoices ────────── */

export async function fetchInvoices(params?: Record<string, string>) {
  return fetchFeePages<StudentInvoice>("/fees/invoices/", params);
}

export async function fetchInvoiceDetail(id: number) {
  const res = await api.get<StudentInvoice>(`/fees/invoices/${id}/`);
  return res.data;
}

export async function generateInvoices(data: { billing_year: number; billing_month: number; due_date: string }) {
  const res = await api.post<{ created: number; skipped: number; errors: string[] }>(
    "/fees/invoices/generate/",
    data,
  );
  return res.data;
}

export async function cancelInvoice(id: number) {
  await api.delete(`/fees/invoices/${id}/`);
}

/* ────────── API: Payments ────────── */

export async function fetchPayments(params?: Record<string, string>) {
  return fetchFeePages<FeePayment>("/fees/payments/", params);
}

export async function recordPayment(data: {
  invoice_id: number;
  amount: number;
  expected_paid_amount: number;
  idempotency_key: string;
  payment_method: PaymentMethod;
  paid_at?: string;
  receipt_note?: string;
  memo?: string;
}) {
  const session = readAuthTokenEnvelopeSafely();
  const tenant = getTenantCodeForApiRequest();
  if (!session || !tenant) throw new Error("로그인 상태를 확인한 뒤 다시 시도해 주세요.");
  const res = await api.post<FeePayment>("/fees/payments/", data, createAuthSessionBoundConfig(session.generation, undefined, tenant));
  return res.data;
}

export async function cancelPayment(id: number) {
  const res = await api.post<FeePayment>(`/fees/payments/${id}/cancel/`);
  return res.data;
}

/* ────────── API: Dashboard ────────── */

export async function fetchDashboard(params?: { year?: number; month?: number }) {
  const res = await api.get<DashboardStats>("/fees/dashboard/", { params });
  return res.data;
}

export async function fetchOverdueInvoices() {
  return fetchFeePages<StudentInvoice>("/fees/dashboard/overdue/");
}
