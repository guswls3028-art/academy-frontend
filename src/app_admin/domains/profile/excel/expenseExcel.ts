import { Expense } from "../api/profile.api";
import { downloadRowsWorkbook } from "./excelUtils";

export function downloadExpenseExcel({
  month,
  rows,
}: {
  month: string;
  rows: Expense[];
}): Promise<void> {
  return downloadRowsWorkbook({
    filename: `expenses_${month}.xlsx`,
    sheetName: "지출",
    rows,
    headers: [
    { key: "date", label: "날짜" },
    { key: "title", label: "항목" },
    { key: "amount", label: "금액" },
    { key: "memo", label: "메모" },
    ],
  });
}
