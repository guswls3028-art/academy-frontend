import { Attendance } from "../api/profile.api";
import { downloadRowsWorkbook } from "./excelUtils";

export function downloadAttendanceExcel({
  month,
  rows,
}: {
  month: string;
  rows: Attendance[];
}): Promise<void> {
  return downloadRowsWorkbook({
    filename: `attendance_${month}.xlsx`,
    sheetName: "근태",
    rows,
    headers: [
    { key: "date", label: "날짜" },
    { key: "work_type", label: "근무유형" },
    { key: "start_time", label: "시작" },
    { key: "end_time", label: "종료" },
    { key: "duration_hours", label: "근무시간" },
    { key: "amount", label: "금액" },
    { key: "memo", label: "메모" },
    ],
  });
}
