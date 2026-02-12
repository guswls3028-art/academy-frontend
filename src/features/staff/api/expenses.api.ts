// PATH: src/features/staff/api/expenses.api.ts
import api from "@/shared/api/axios";

/** Backend: ExpenseRecord.STATUS_CHOICES */
export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Backend: ExpenseRecordSerializer */
export type ExpenseRecord = {
  id: number;
  staff: number;
  staff_name: string;
  date: string;
  title: string;
  amount: number;
  memo: string;
  status: ExpenseStatus;
  approved_at: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * GET /staffs/expense-records/
 */
export async function fetchExpenses(params: {
  staff: number;
  status?: ExpenseStatus;
  date_from: string;
  date_to: string;
}) {
  const res = await api.get("/staffs/expense-records/", { params });

  if (Array.isArray(res.data)) return res.data as ExpenseRecord[];
  if (Array.isArray(res.data?.results)) return res.data.results as ExpenseRecord[];
  return [];
}

/**
 * POST /staffs/expense-records/
 * - 마감된 월이면 backend가 400 보장
 */
export async function createExpense(payload: {
  staff: number;
  date: string;
  title: string;
  amount: number;
  memo?: string;
}) {
  const res = await api.post("/staffs/expense-records/", {
    staff: payload.staff,
    date: payload.date,
    title: payload.title,
    amount: payload.amount,
    memo: payload.memo ?? "",
  });

  return res.data as ExpenseRecord;
}

/**
 * PATCH /staffs/expense-records/{id}/
 * 🔒 APPROVED 이후 수정 불가 (백엔드 보장)
 * - 상태 변경은 관리자만 가능 (백엔드 보장)
 */
export async function patchExpense(
  id: number,
  payload: Partial<{
    status: ExpenseStatus;
    memo: string;
  }>
) {
  const res = await api.patch(`/staffs/expense-records/${id}/`, payload);
  return res.data as ExpenseRecord;
}
