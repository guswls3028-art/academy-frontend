// PATH: src/features/staff/api/staff.api.ts
import api from "@/shared/api/axios";

/* =========================
 * Types
 * ========================= */

export type Staff = {
  id: number;
  name: string;
  phone: string;
  is_active: boolean;
  is_manager: boolean;
  pay_type: "HOURLY" | "MONTHLY";
};

export type StaffSummary = {
  staff_id: number;
  work_hours: number;
  work_amount: number;
  expense_amount: number;
  total_amount: number;
};

/* =========================
 * APIs
 * ========================= */

// 직원 목록
export const fetchStaffs = async (params?: {
  search?: string;
  is_active?: boolean;
  is_manager?: boolean;
  pay_type?: string;
}) => {
  const res = await api.get("/staffs/", { params });
  return res.data as Staff[];
};

// 직원 요약 (기간 기준)
export const fetchStaffSummary = async (
  staffId: number,
  params: { date_from: string; date_to: string }
) => {
  const res = await api.get(`/staffs/${staffId}/summary/`, { params });
  return res.data as StaffSummary;
};
