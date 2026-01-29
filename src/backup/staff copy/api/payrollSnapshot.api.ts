// PATH: src/features/staff/api/payrollSnapshot.api.ts
import api from "@/shared/api/axios";

/* =========================
 * Types
 * ========================= */

export type PayrollSnapshot = {
  id: number;
  staff: number;
  staff_name?: string;
  year: number;
  month: number;

  work_hours: number;
  work_amount: number;
  approved_expense_amount: number;
  total_amount: number;

  generated_by?: number;
  generated_by_name?: string;
  created_at: string;
};

/* =========================
 * APIs (READ ONLY)
 * ========================= */

// 월별/연도별 스냅샷 조회
export async function fetchPayrollSnapshots(params: {
  year?: number;
  month?: number;
  staff?: number;
}) {
  const cleanParams: any = {};
  if (params.staff != null) cleanParams.staff = params.staff;
  if (params.year != null) cleanParams.year = params.year;
  if (params.month != null) cleanParams.month = params.month;

  const res = await api.get("/payroll-snapshots/", { params: cleanParams });
  return res.data as PayrollSnapshot[];
}

// 월별 스냅샷 엑셀 다운로드
export async function exportPayrollSnapshotExcel(params: {
  year: number;
  month: number;
}) {
  const res = await api.get("/payroll-snapshots/export-excel/", {
    params,
    responseType: "blob",
  });

  const blob = new Blob([res.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${params.year}_${String(params.month).padStart(2, "0")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
