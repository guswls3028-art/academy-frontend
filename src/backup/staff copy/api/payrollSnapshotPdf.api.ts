// PATH: src/features/staff/api/payrollSnapshotPdf.api.ts
import api from "@/shared/api/axios";

/**
 * PayrollSnapshot 기반 PDF 급여명세서 다운로드
 * Backend Single Source of Truth
 */
export async function exportPayrollSnapshotPdf(params: {
  staff: number;
  year: number;
  month: number;
}) {
  const res = await api.get("/payroll-snapshots/export-pdf/", {
    params,
    responseType: "blob",
  });

  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${params.staff}_${params.year}_${String(
    params.month
  ).padStart(2, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
