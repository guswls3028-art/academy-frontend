// PATH: src/features/profile/api/profile.ts
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

export const fetchMe = async () => {
  const res = await api.get<Me>("/core/me/");
  return res.data;
};

export const updateProfile = async (data: { name?: string; phone?: string }) => {
  const res = await api.patch("/core/profile/update_me/", data);
  return res.data as { id: number; name?: string | null; phone?: string | null };
};

export const changePassword = async (data: {
  old_password: string;
  new_password: string;
}) => {
  const res = await api.post("/core/profile/change-password/", data);
  return res.data as { message: string };
};

/* =====================
 * Attendance
 * ===================== */
export type Attendance = {
  id: number;
  user: number;
  date: string;
  start_time: string;
  end_time: string;
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

export const fetchMyAttendance = async (month?: string) => {
  const res = await api.get<Attendance[]>("/core/profile/attendance/", {
    params: month ? { month } : {},
  });
  return res.data;
};

export const fetchAttendanceSummary = async (month?: string) => {
  const res = await api.get<AttendanceSummary>(
    "/core/profile/attendance/summary/",
    { params: month ? { month } : {} }
  );
  return res.data;
};

export const createAttendance = async (data: {
  date: string;
  start_time: string;
  end_time: string;
  work_type: string;
  memo?: string;
}) => {
  const res = await api.post<Attendance>("/core/profile/attendance/", data);
  return res.data;
};

export const updateAttendance = async (
  id: number,
  data: Partial<{
    date: string;
    start_time: string;
    end_time: string;
    work_type: string;
    memo?: string;
  }>
) => {
  const res = await api.patch<Attendance>(
    `/core/profile/attendance/${id}/`,
    data
  );
  return res.data;
};

export const deleteAttendance = async (id: number) => {
  await api.delete(`/core/profile/attendance/${id}/`);
};

/* =====================
 * Expense
 * ===================== */
export type Expense = {
  id: number;
  user: number;
  date: string;
  title: string;
  amount: number;
  memo?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const fetchMyExpenses = async (month?: string) => {
  const res = await api.get<Expense[]>("/core/profile/expenses/", {
    params: month ? { month } : {},
  });
  return res.data;
};

export const createExpense = async (data: {
  date: string;
  title: string;
  amount: number;
  memo?: string;
}) => {
  const res = await api.post<Expense>("/core/profile/expenses/", data);
  return res.data;
};

export const deleteExpense = async (id: number) => {
  await api.delete(`/core/profile/expenses/${id}/`);
};
