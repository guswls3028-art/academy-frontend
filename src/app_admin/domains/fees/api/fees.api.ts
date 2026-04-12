// PATH: src/app_admin/domains/fees/api/fees.ts

import api from "@/shared/api/axios";

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
  const res = await api.get("/lectures/lectures/", { params: { is_active: true } });
  const data = res.data;
  const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  return list.map((l: any) => ({ id: l.id, title: l.title }));
}

/* ────────── helpers ────────── */

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

function unwrapList<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

/* ────────── API: Fee Templates ────────── */

export async function fetchFeeTemplates(params?: Record<string, string>) {
  const res = await api.get("/fees/templates/", { params });
  return unwrapList<FeeTemplate>(res.data);
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
  const res = await api.get("/fees/student-fees/", { params });
  return unwrapList<StudentFee>(res.data);
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
  const res = await api.get("/fees/invoices/", { params: { ...params, page_size: "500" } });
  const data = res.data;
  const list = unwrapList<StudentInvoice>(data);
  // Attach total count for UI
  (list as any).__totalCount = data?.count ?? list.length;
  return list;
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
  const res = await api.get("/fees/payments/", { params });
  return unwrapList<FeePayment>(res.data);
}

export async function recordPayment(data: {
  invoice_id: number;
  amount: number;
  payment_method: PaymentMethod;
  paid_at?: string;
  receipt_note?: string;
  memo?: string;
}) {
  const res = await api.post<FeePayment>("/fees/payments/", data);
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
  const res = await api.get("/fees/dashboard/overdue/");
  return unwrapList<StudentInvoice>(res.data);
}
