// PATH: src/features/profile/excel/expenseExcel.ts
import * as XLSX from "xlsx";
import { Expense } from "../api/profile";
import { createSheet, downloadWorkbook } from "./excelUtils";

export function downloadExpenseExcel({
  month,
  rows,
}: {
  month: string;
  rows: Expense[];
}) {
  const wb = XLSX.utils.book_new();

  const sheet = createSheet(rows, [
    { key: "date", label: "날짜" },
    { key: "title", label: "항목" },
    { key: "amount", label: "금액" },
    { key: "memo", label: "메모" },
  ]);

  XLSX.utils.book_append_sheet(wb, sheet, "지출");

  downloadWorkbook(wb, `expenses_${month}.xlsx`);
}
