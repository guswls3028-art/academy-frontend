// PATH: src/features/staff/api/payrollSnapshots.api.ts
import api from "@/shared/api/axios";

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

/**
 * GET /staffs/payroll-snapshots/
 */
export async function fetchPayrollSnapshots(params: {
  year?: number;
  month?: number;
  staff?: number;
}) {
  const cleanParams: any = {};
  if (params.staff != null) cleanParams.staff = params.staff;
  if (params.year != null) cleanParams.year = params.year;
  if (params.month != null) cleanParams.month = params.month;

  const res = await api.get("/staffs/payroll-snapshots/", {
    params: cleanParams,
  });

  if (Array.isArray(res.data)) return res.data as PayrollSnapshot[];
  if (Array.isArray(res.data?.results)) return res.data.results as PayrollSnapshot[];
  return [];
}

/**
 * GET /staffs/payroll-snapshots/export-excel/
 */
export async function exportPayrollSnapshotExcel(params: {
  year: number;
  month: number;
}) {
  const res = await api.get(
    "/staffs/payroll-snapshots/export-excel/",
    {
      params,
      responseType: "blob",
    }
  );

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
