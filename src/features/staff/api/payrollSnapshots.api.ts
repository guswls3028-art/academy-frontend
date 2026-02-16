// PATH: src/features/staff/api/payrollSnapshots.api.ts
import api from "@/shared/api/axios";
import { pollJobUntilDone, downloadFromUrl } from "@/shared/api/jobExport";

/** Backend: PayrollSnapshotSerializer (work_hours Decimal, no updated_at) */
export type PayrollSnapshot = {
  id: number;
  staff: number;
  staff_name: string;
  year: number;
  month: number;
  work_hours: number;
  work_amount: number;
  approved_expense_amount: number;
  total_amount: number;
  generated_by: number | null;
  generated_by_name: string | null;
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
 * POST /staffs/payroll-snapshots/export-excel/ → job_id → 폴링 → download_url 다운로드
 */
export async function exportPayrollSnapshotExcel(params: {
  year: number;
  month: number;
}): Promise<void> {
  const res = await api.post<{ job_id: string; status: string }>(
    "/staffs/payroll-snapshots/export-excel/",
    params
  );
  const jobId = res.data?.job_id;
  if (!jobId) throw new Error("Export job could not be started.");

  const data = await pollJobUntilDone(jobId);
  const url = data.result?.download_url;
  const filename =
    data.result?.filename ||
    `payroll_${params.year}_${String(params.month).padStart(2, "0")}.xlsx`;
  if (!url) throw new Error("Export completed but no download link.");
  downloadFromUrl(url, filename);
}
