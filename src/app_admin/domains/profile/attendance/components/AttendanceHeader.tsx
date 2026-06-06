// PATH: src/app_admin/domains/profile/attendance/components/AttendanceHeader.tsx
import { Button, Panel } from "@/shared/ui/ds";
import { Attendance } from "../../api/profile.api";
import { downloadAttendanceExcel } from "../../excel/attendanceExcel";
import { FiPlus, FiDownload } from "react-icons/fi";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function AttendanceHeader({
  range,
  resetRangeToMonth,
  rowsForExcel,
  onCreate,
}: {
  range: { from: string; to: string };
  resetRangeToMonth: (m?: string) => void;
  rowsForExcel: Attendance[];
  onCreate: () => void;
}) {
  const monthValue =
    range.from?.slice(0, 7) || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();

  return (
    <Panel variant="subtle">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            기간 선택
          </div>
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => resetRangeToMonth()}
          >
            전체
          </Button>

          <input
            type="month"
            value={monthValue}
            onChange={(e) => resetRangeToMonth(e.target.value)}
            className="ds-input w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => {
              void downloadAttendanceExcel({ month: monthValue, rows: rowsForExcel })
                .catch(() => feedback.error("엑셀 다운로드에 실패했습니다."));
            }}
            leftIcon={<FiDownload size={14} />}
          >
            Excel
          </Button>

          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={onCreate}
            leftIcon={<FiPlus size={14} />}
          >
            근태 등록
          </Button>
        </div>
      </div>
    </Panel>
  );
}
