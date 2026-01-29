// PATH: src/features/profile/excel/excelUtils.ts
import * as XLSX from "xlsx";

export function downloadWorkbook(
  workbook: XLSX.WorkBook,
  filename: string
) {
  XLSX.writeFile(workbook, filename);
}

export function createSheet<T extends Record<string, any>>(
  rows: T[],
  headers: { key: keyof T; label: string }[]
) {
  const data = [
    headers.map((h) => h.label),
    ...rows.map((r) => headers.map((h) => r[h.key] ?? "")),
  ];
  return XLSX.utils.aoa_to_sheet(data);
}
