// PATH: src/features/staff/api/staffExpense.api.ts
import api from "@/shared/api/axios";

export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ExpenseRecord = {
  id: number;
  staff: number;
  staff_name?: string;
  date: string; // YYYY-MM-DD
  title: string;
  amount: number;
  memo: string;
  status: ExpenseStatus;

  approved_at?: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;

  created_at?: string;
  updated_at?: string;
};

export const fetchExpenses = async (params: {
  staff: number;
  date_from: string;
  date_to: string;
  status?: ExpenseStatus;
}) => {
  const res = await api.get("/expense-records/", { params });
  return res.data as ExpenseRecord[];
};

export const createExpense = async (payload: {
  staff: number;
  date: string;
  title: string;
  amount: number;
  memo?: string;
  status?: ExpenseStatus; // 관리자 UX용 (기본은 PENDING)
}) => {
  const res = await api.post("/expense-records/", payload);
  return res.data as ExpenseRecord;
};

export const patchExpense = async (
  id: number,
  payload: Partial<{
    date: string;
    title: string;
    amount: number;
    memo: string;
    status: ExpenseStatus;
  }>
) => {
  try {
    const res = await api.patch(`/expense-records/${id}/`, payload);
    return res.data as ExpenseRecord;
  } catch (e: any) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.detail ||
      "비용을 수정할 수 없습니다.";
    alert(msg);
    throw e;
  }
};

export const deleteExpense = async (id: number) => {
  try {
    await api.delete(`/expense-records/${id}/`);
    return true;
  } catch (e: any) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.detail ||
      "비용을 삭제할 수 없습니다.";
    alert(msg);
    throw e;
  }
};
