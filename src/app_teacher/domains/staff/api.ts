// PATH: src/app_teacher/domains/staff/api.ts
// 직원 관리자용 API — 직원별 근태/비용/급여 조회 및 관리
import api from "@/shared/api/axios";

/* ─── Types ─── */
export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StaffMember {
  id: number;
  name: string;
  username?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
}

export interface WorkRecord {
  id: number;
  staff: number;
  staff_name?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  meal_minutes?: number;
  work_hours?: number;             // 실제 백엔드 필드 (duration_hours 아님)
  amount?: number;
  adjustment_amount?: number;
  resolved_hourly_wage?: number;   // 실제 백엔드 필드 (hourly_rate 아님)
  work_type?: number | string;
  work_type_name?: string;
  is_manually_edited?: boolean;
  memo?: string;
}

export interface ExpenseRecord {
  id: number;
  staff: number;
  staff_name?: string;
  date: string;
  title: string;
  amount: number;
  status?: ExpenseStatus;
  memo?: string;
}

export interface PayrollSnapshot {
  id: number;
  staff: number;
  staff_name?: string;
  year: number;                          // 백엔드는 year + month 분리
  month: number;                         // 1~12 숫자
  work_hours: number;                    // 실제 필드 (total_hours 아님)
  work_amount: number;                   // 실제 필드 (base_pay 아님)
  approved_expense_amount: number;       // 실제 필드 (expense_total 아님)
  total_amount: number;                  // 실제 필드 (net_pay 아님)
  generated_by?: number;
  generated_by_name?: string;
  created_at?: string;
}

export interface WorkMonthLock {
  id: number;
  staff: number;
  year: number;
  month: number;
  is_locked: boolean;
  locked_at?: string;
  created_at?: string;
}

export interface WorkType {
  id: number;
  name: string;
  base_hourly_wage?: number;
  color?: string;
  description?: string;
  is_active?: boolean;
}

function monthRange(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  const lastDay = new Date(year, monthValue, 0).getDate();
  const mm = String(monthValue).padStart(2, "0");
  return {
    year,
    month: monthValue,
    date_from: `${year}-${mm}-01`,
    date_to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function normalizeExpenseStatus(status?: string): ExpenseStatus {
  const upper = String(status || "PENDING").toUpperCase();
  if (upper === "APPROVED" || upper === "REJECTED") return upper;
  return "PENDING";
}

function normalizeExpenseRecord(record: ExpenseRecord): ExpenseRecord {
  return { ...record, status: normalizeExpenseStatus(record.status) };
}

/* ─── Work Records ─── */
export async function fetchWorkRecords(params: { staff: number; month: string }) {
  const range = monthRange(params.month);
  const res = await api.get("/staffs/work-records/", {
    params: {
      staff: params.staff,
      date_from: range.date_from,
      date_to: range.date_to,
      page_size: 200,
    },
  });
  const raw = res.data;
  const items: WorkRecord[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
  return items;
}

export async function createWorkRecord(payload: Partial<WorkRecord>): Promise<WorkRecord> {
  const res = await api.post("/staffs/work-records/", payload);
  return res.data;
}

export async function updateWorkRecord(id: number, payload: Partial<WorkRecord>): Promise<WorkRecord> {
  const res = await api.patch(`/staffs/work-records/${id}/`, payload);
  return res.data;
}

export async function deleteWorkRecord(id: number): Promise<void> {
  await api.delete(`/staffs/work-records/${id}/`);
}

/* ─── Expense Records ─── */
export async function fetchExpenseRecords(params: { staff?: number; month?: string }): Promise<ExpenseRecord[]> {
  const q: Record<string, unknown> = { staff: params.staff, page_size: 200 };
  if (params.month) {
    const range = monthRange(params.month);
    q.date_from = range.date_from;
    q.date_to = range.date_to;
  }
  const res = await api.get("/staffs/expense-records/", { params: q });
  const raw = res.data;
  const items: ExpenseRecord[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
  return items.map(normalizeExpenseRecord);
}

export async function updateExpenseStatus(id: number, status: Extract<ExpenseStatus, "APPROVED" | "REJECTED">): Promise<ExpenseRecord> {
  const res = await api.patch(`/staffs/expense-records/${id}/`, { status });
  return normalizeExpenseRecord(res.data);
}

export async function createExpenseRecord(payload: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
  const res = await api.post("/staffs/expense-records/", payload);
  return normalizeExpenseRecord(res.data);
}

export async function deleteExpenseRecord(id: number): Promise<void> {
  await api.delete(`/staffs/expense-records/${id}/`);
}

/* ─── Payroll ─── */
export async function fetchPayrollSnapshots(params: { staff?: number; year?: number; month?: number }): Promise<PayrollSnapshot[]> {
  const res = await api.get("/staffs/payroll-snapshots/", { params: { ...params, page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/* ─── Month Lock ─── */
export async function fetchWorkMonthLocks(params: { staff?: number; month?: string }): Promise<WorkMonthLock[]> {
  const q: Record<string, unknown> = { staff: params.staff };
  let range: ReturnType<typeof monthRange> | null = null;
  if (params.month) {
    range = monthRange(params.month);
    q.year = range.year;
    q.month = range.month;
  }
  const res = await api.get("/staffs/work-month-locks/", { params: q });
  const raw = res.data;
  const items: WorkMonthLock[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
  return items.filter((lock) => {
    if (params.staff != null && Number(lock.staff) !== Number(params.staff)) return false;
    if (range && (Number(lock.year) !== range.year || Number(lock.month) !== range.month)) return false;
    return lock.is_locked !== false;
  });
}

export async function createWorkMonthLock(payload: { staff: number; month: string }): Promise<WorkMonthLock> {
  const range = monthRange(payload.month);
  const res = await api.post("/staffs/work-month-locks/", { staff: payload.staff, year: range.year, month: range.month });
  return res.data;
}

export async function deleteWorkMonthLock(id: number): Promise<void> {
  await api.delete(`/staffs/work-month-locks/${id}/`);
}

/* ─── Basic Staff (Reused) ─── */
export async function fetchStaffOne(id: number): Promise<StaffMember> {
  const res = await api.get(`/staffs/${id}/`);
  return res.data;
}

/* ─── Work Types (시급 태그) ─── */
export async function fetchWorkTypes(): Promise<WorkType[]> {
  const res = await api.get("/staffs/work-types/", { params: { page_size: 100, is_active: true } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
