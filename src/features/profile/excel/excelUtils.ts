// PATH: src/features/profile/excel/excelUtils.ts
import * as XLSX from "xlsx";

export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

export function createSheet<T extends Record<string, any>>(
  rows: T[] | unknown,
  headers: { key: keyof T; label: string }[]
) {
  /** ✅ rows 방어 */
  const safeRows = Array.isArray(rows) ? rows : [];

  const data = [
    headers.map((h) => h.label),
    ...safeRows.map((r) => headers.map((h) => r[h.key] ?? "")),
  ];

  return XLSX.utils.aoa_to_sheet(data);
}
