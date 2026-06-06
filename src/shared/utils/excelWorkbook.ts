// PATH: src/shared/utils/excelWorkbook.ts
import * as ExcelJS from "exceljs";
import { downloadBlob } from "@/shared/utils/safeDownload";

export type ExcelCell = string | number | boolean | Date | null | undefined;
export type ExcelRow = ExcelCell[];

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_IMPORT_ROWS = 10_000;
const MAX_IMPORT_COLUMNS = 120;

export function createWorkbook(): ExcelJS.Workbook {
  return new ExcelJS.Workbook();
}

export function addArrayWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: readonly ExcelRow[],
  columnWidths?: readonly number[],
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(safeWorksheetName(sheetName));
  worksheet.addRows(rows.map((row) => row.map((cell) => cell ?? "")));
  if (columnWidths?.length) {
    worksheet.columns = columnWidths.map((width) => ({ width }));
  }
  return worksheet;
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
}

export async function downloadArrayWorksheet({
  filename,
  sheetName,
  rows,
  columnWidths,
}: {
  filename: string;
  sheetName: string;
  rows: readonly ExcelRow[];
  columnWidths?: readonly number[];
}): Promise<void> {
  const workbook = createWorkbook();
  addArrayWorksheet(workbook, sheetName, rows, columnWidths);
  await downloadWorkbook(workbook, filename);
}

export async function readFirstWorksheetRows(file: File): Promise<unknown[][]> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("보안상 .xlsx 파일만 지원합니다. 구형 .xls 또는 .csv 파일은 .xlsx로 저장한 뒤 업로드해 주세요.");
  }

  const workbook = createWorkbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("시트가 없습니다.");
  }
  if (worksheet.rowCount > MAX_IMPORT_ROWS || worksheet.columnCount > MAX_IMPORT_COLUMNS) {
    throw new Error(`엑셀은 최대 ${MAX_IMPORT_ROWS.toLocaleString()}행, ${MAX_IMPORT_COLUMNS}열까지 업로드할 수 있습니다.`);
  }

  const rows: unknown[][] = [];
  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values: unknown[] = [];
    for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
      values.push(cellValueToPlainValue(row.getCell(columnIndex).value));
    }
    trimTrailingEmptyCells(values);
    if (values.some((value) => String(value ?? "").trim())) {
      rows.push(values);
    }
  }
  return rows;
}

function safeWorksheetName(sheetName: string): string {
  const cleaned = sheetName
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/[:*?/\\]/g, " ")
    .trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

function cellValueToPlainValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  if ("result" in value) return cellValueToPlainValue(value.result as ExcelJS.CellValue);
  if ("hyperlink" in value && "text" in value && typeof value.text === "string") return value.text;
  return String(value);
}

function trimTrailingEmptyCells(values: unknown[]): void {
  while (values.length > 0 && !String(values[values.length - 1] ?? "").trim()) {
    values.pop();
  }
}
