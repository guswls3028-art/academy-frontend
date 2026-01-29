// PATH: src/features/profile/api/profile.api.ts
import api from "@/shared/api/axios";

/* =====================
 * User
 * ===================== */
export type Me = {
  id: number;
  username: string;
  name?: string | null;
  phone?: string | null;
  is_staff: boolean;
  is_superuser?: boolean;
};

export async function fetchMe() {
  const { data } = await api.get<Me>("/core/me/");
  return data;
}

export async function updateProfile(payload: { name?: string; phone?: string }) {
  const { data } = await api.patch("/core/profile/update_me/", payload);
  return data as { id: number; name?: string | null; phone?: string | null };
}

export async function changePassword(payload: {
  old_password: string;
  new_password: string;
}) {
  const { data } = await api.post("/core/profile/change-password/", payload);
  return data as { message?: string };
}

/* =====================
 * Attendance
 * ===================== */
export type Attendance = {
  id: number;
  user?: number;
  date: string;
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  work_type: string;
  memo?: string | null;
  duration_hours: number;
  amount: number;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceSummary = {
  total_hours: number;
  total_amount: number;
  total_after_tax: number;
};

export async function fetchMyAttendance(month?: string) {
  const { data } = await api.get<Attendance[]>("/core/profile/attendance/", {
    params: month ? { month } : {},
  });
  return data;
}

export async function fetchAttendanceSummary(month?: string) {
  const { data } = await api.get<AttendanceSummary>(
    "/core/profile/attendance/summary/",
    { params: month ? { month } : {} }
  );
  return data;
}

export async function createAttendance(payload: {
  date: string;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  work_type: string;
  memo?: string;
}) {
  const { data } = await api.post<Attendance>("/core/profile/attendance/", payload);
  return data;
}

export async function updateAttendance(
  id: number,
  payload: Partial<{
    date: string;
    start_time: string; // "HH:MM"
    end_time: string; // "HH:MM"
    work_type: string;
    memo?: string;
  }>
) {
  const { data } = await api.patch<Attendance>(`/core/profile/attendance/${id}/`, payload);
  return data;
}

export async function deleteAttendance(id: number) {
  await api.delete(`/core/profile/attendance/${id}/`);
}

/* =====================
 * Expense
 * ===================== */
export type Expense = {
  id: number;
  user?: number;
  date: string;
  title: string;
  amount: number;
  memo?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function fetchMyExpenses(month?: string) {
  const { data } = await api.get<Expense[]>("/core/profile/expenses/", {
    params: month ? { month } : {},
  });
  return data;
}

export async function createExpense(payload: {
  date: string;
  title: string;
  amount: number;
  memo?: string;
}) {
  const { data } = await api.post<Expense>("/core/profile/expenses/", payload);
  return data;
}

// ✅ 실사용 핵심: 지출 수정(편집)
export async function updateExpense(
  id: number,
  payload: Partial<{
    date: string;
    title: string;
    amount: number;
    memo?: string;
  }>
) {
  const { data } = await api.patch<Expense>(`/core/profile/expenses/${id}/`, payload);
  return data;
}

export async function deleteExpense(id: number) {
  await api.delete(`/core/profile/expenses/${id}/`);
}
