// PATH: src/features/profile/excel/attendanceExcel.ts
import * as XLSX from "xlsx";
import { Attendance } from "../api/profile";
import { createSheet, downloadWorkbook } from "./excelUtils";

export function downloadAttendanceExcel({
  month,
  rows,
}: {
  month: string;
  rows: Attendance[];
}) {
  const wb = XLSX.utils.book_new();

  const sheet = createSheet(rows, [
    { key: "date", label: "날짜" },
    { key: "work_type", label: "근무유형" },
    { key: "start_time", label: "시작" },
    { key: "end_time", label: "종료" },
    { key: "duration_hours", label: "근무시간" },
    { key: "amount", label: "금액" },
    { key: "memo", label: "메모" },
  ]);

  XLSX.utils.book_append_sheet(wb, sheet, "근태");

  downloadWorkbook(wb, `attendance_${month}.xlsx`);
}
