// PATH: src/app_admin/domains/profile/excel/excelUtils.ts
import { downloadArrayWorksheet, type ExcelRow } from "@/shared/utils/excelWorkbook";

export function createRows<T extends object>(
  rows: T[] | unknown,
  headers: { key: keyof T; label: string }[]
): ExcelRow[] {
  const safeRows = Array.isArray(rows) ? rows as T[] : [];

  return [
    headers.map((h) => h.label),
    ...safeRows.map((r) => headers.map((h) => toExcelCell(r[h.key]))),
  ];
}

export async function downloadRowsWorkbook<T extends object>({
  filename,
  sheetName,
  rows,
  headers,
}: {
  filename: string;
  sheetName: string;
  rows: T[] | unknown;
  headers: { key: keyof T; label: string }[];
}): Promise<void> {
  await downloadArrayWorksheet({
    filename,
    sheetName,
    rows: createRows(rows, headers),
  });
}

function toExcelCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }
  return String(value);
}
