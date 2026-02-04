﻿// PATH: src/features/staff/api/staff.api.ts
import api from "@/shared/api/axios";

/**
 * Staff (직원)
 */
export type Staff = {
  id: number;
  name: string;
  phone: string;
  is_active: boolean;
  is_manager: boolean;
  pay_type: "HOURLY" | "MONTHLY";
  staff_work_types?: {
    id: number;
    work_type: number;
    hourly_wage: number | null;
    effective_hourly_wage: number;
  }[];
  created_at?: string;
  updated_at?: string;
};

/**
 * Staff Summary (집계 전용)
 * 🔒 계산 단일진실
 */
export type StaffSummary = {
  staff_id: number;
  work_hours: number;
  work_amount: number;
  expense_amount: number;
  total_amount: number;
};

/**
 * GET /staffs/
 */
export async function fetchStaffs(params?: {
  search?: string;
  is_active?: boolean;
  is_manager?: boolean;
  pay_type?: string;
}) {
  const res = await api.get("/staffs/", { params });

  if (Array.isArray(res.data)) return res.data as Staff[];
  if (Array.isArray(res.data?.results)) return res.data.results as Staff[];
  return [];
}

/**
 * POST /staffs/
 * 🔒 생성 스펙 단일진실
 *
 * permission_role:
 * - ASSISTANT : 일반 직원
 * - TEACHER   : 강사
 * - ADMIN     : 관리자 (승인/마감 가능)
 *
 * ⚠️ OWNER는 백엔드 전용이며 프론트에서 지정 불가
 * ⚠️ is_manager / is_payroll_manager 변환 책임은 백엔드
 */
export async function createStaff(payload: {
  username: string;
  password: string;
  name: string;
  phone?: string;
  permission_role: "ADMIN" | "TEACHER" | "ASSISTANT";
}) {
  const res = await api.post("/staffs/", payload);
  return res.data as Staff;
}

/**
 * DELETE /staffs/{id}/
 */
export async function deleteStaff(id: number) {
  await api.delete(`/staffs/${id}/`);
  return true;
}
