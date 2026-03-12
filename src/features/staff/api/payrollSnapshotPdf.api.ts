// PATH: src/features/staff/api/payrollSnapshotPDF.api.ts
import api from "@/shared/api/axios";
import { downloadBlob } from "@/shared/utils/safeDownload";

export async function exportPayrollSnapshotPDF(params: {
  staff: number;
  year: number;
  month: number;
}) {
  const res = await api.get(
    "/staffs/payroll-snapshots/export-pdf/",
    {
      params,
      responseType: "blob",
    }
  );

  const blob = new Blob([res.data], { type: "application/pdf" });
  const filename = `payroll_${params.staff}_${params.year}_${String(
    params.month
  ).padStart(2, "0")}.pdf`;
  downloadBlob(blob, filename);
}
