// PATH: src/features/staff/excel/staffExcel.ts
// 선택한 직원 목록을 엑셀로 다운로드 (직원 관리 > 엑셀 다운로드)

import * as XLSX from "xlsx";
import type { Staff } from "../api/staff.api";

const ROLE_LABEL: Record<string, string> = { TEACHER: "강사", ASSISTANT: "조교" };
const PAY_TYPE_LABEL: Record<string, string> = { HOURLY: "시급", MONTHLY: "월급" };

/** 선택한 직원 목록을 엑셀로 다운로드 */
export function downloadStaffExcel(
  rows: Staff[],
  filename = "직원목록.xlsx"
): void {
  const headers = [
    "직위",
    "이름",
    "전화번호",
    "상태",
    "관리자권한",
    "급여유형",
    "시급태그",
    "등록일",
  ];
  const data = [
    headers,
    ...rows.map((r) => [
      ROLE_LABEL[r.role] ?? r.role,
      r.name ?? "",
      r.phone ?? "",
      r.is_active ? "활성" : "비활성",
      r.is_manager ? "ON" : "OFF",
      PAY_TYPE_LABEL[r.pay_type] ?? r.pay_type,
      (r.staff_work_types ?? [])
        .map((swt) => swt.work_type?.name ?? "")
        .filter(Boolean)
        .join(", "),
      r.created_at ? r.created_at.slice(0, 10) : "",
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = headers.map((_, i) => ({ wch: i === 2 ? 14 : i === 6 ? 24 : 10 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "직원목록");
  XLSX.writeFile(wb, filename);
}
