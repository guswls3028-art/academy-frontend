// PATH: src/features/staff/api/payrollSnapshotPDF.api.ts
import api from "@/shared/api/axios";

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
