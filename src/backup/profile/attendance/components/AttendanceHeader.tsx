// PATH: src/features/profile/attendance/components/AttendanceHeader.tsx
import { downloadAttendanceExcel } from "@/features/profile/excel/attendanceExcel";
import { Attendance } from "@/features/profile/api/profile";

export default function AttendanceHeader({
  month,
  setMonth,
  rows,
}: {
  month: string;
  setMonth: (v: string) => void;
  rows: Attendance[];
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="form-input w-[160px]"
      />
      <button
        onClick={() => downloadAttendanceExcel({ month, rows })}
        className="btn-secondary text-sm"
      >
        📊 Excel 다운로드
      </button>
    </div>
  );
}
