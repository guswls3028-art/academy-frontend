// PATH: src/features/staff/api/staffReport.api.ts
import { fetchStaffDetail } from "./staff.detail.api";
import { fetchStaffSummaryByRange } from "./staff.detail.api";
import { fetchWorkRecords } from "./staffWorkRecord.api";
import { fetchExpenses } from "./staffExpense.api";

function toSafeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ✅ SheetJS(xlsx) 기반. 프로젝트에 xlsx 없으면 안내 alert
export async function exportStaffReportXlsx(params: {
  staffId: number;
  date_from: string;
  date_to: string;
}) {
  let XLSX: any;
  try {
    XLSX = await import("xlsx");
  } catch {
    alert('엑셀 다운로드를 위해 "xlsx" 패키지가 필요합니다.\n\nnpm i xlsx');
    return;
  }

  const { staffId, date_from, date_to } = params;

  const [staff, summary, workRecords, expenses] = await Promise.all([
    fetchStaffDetail(staffId),
    fetchStaffSummaryByRange(staffId, date_from, date_to),
    fetchWorkRecords({ staff: staffId, date_from, date_to }),
    fetchExpenses({ staff: staffId, date_from, date_to }),
  ]);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryRows = [
    ["Staff ID", staff.id],
    ["Name", staff.name],
    ["Phone", staff.phone || ""],
    ["Pay Type", staff.pay_type],
    ["Range", `${date_from} ~ ${date_to}`],
    [],
    ["Work Hours", toSafeNumber(summary.work_hours)],
    ["Work Amount", toSafeNumber(summary.work_amount)],
    ["Expense Amount", toSafeNumber(summary.expense_amount)],
    ["Total Amount", toSafeNumber(summary.total_amount)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Sheet 2: WorkRecords
  const wrRows = (workRecords ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    work_type: r.work_type_name ?? r.work_type,
    start_time: (r.start_time || "").slice(0, 5),
    end_time: (r.end_time || "").slice(0, 5),
    break_minutes: toSafeNumber(r.break_minutes),
    work_hours: r.work_hours ?? "",
    amount: toSafeNumber(r.amount),
    memo: r.memo ?? "",
  }));
  const wsWR = XLSX.utils.json_to_sheet(wrRows);
  XLSX.utils.book_append_sheet(wb, wsWR, "WorkRecords");

  // Sheet 3: Expenses
  const exRows = (expenses ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    amount: toSafeNumber(e.amount),
    status: e.status,
    memo: e.memo ?? "",
  }));
  const wsEX = XLSX.utils.json_to_sheet(exRows);
  XLSX.utils.book_append_sheet(wb, wsEX, "Expenses");

  const filename = `staff_report_${staff.id}_${date_from}_${date_to}.xlsx`;
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    filename,
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}
