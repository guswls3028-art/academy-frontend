import { resolveTenantCodeString } from "@/shared/tenant";
import { SelectionButton } from "@/shared/ui/ds";
import {
  ATTENDANCE_META,
  ORDERED_ATTENDANCE_STATUS,
  type AttendanceStatus,
} from "@/shared/ui/badges/attendanceStatus";

type Props = {
  studentName: string;
  value: AttendanceStatus;
  pending: boolean;
  onChange: (status: AttendanceStatus) => void;
};

export default function AttendanceStatusOptions({ studentName, value, pending, onChange }: Props) {
  const dawon = resolveTenantCodeString() === "dawon";
  return (
    <div
      className="attendance-status-options"
      role="group"
      aria-label={studentName + " 출결 상태 선택"}
      onClick={(event) => event.stopPropagation()}
    >
      {ORDERED_ATTENDANCE_STATUS.map((code) => {
        const { tone } = ATTENDANCE_META[code];
        const label = dawon && code === "PRESENT" ? "출석"
          : dawon && code === "ONLINE" ? "동영상" : ATTENDANCE_META[code].label;
        const selected = value === code;
        return (
          <SelectionButton
            key={code}
            className="attendance-status-option"
            label={label}
            selected={selected}
            tone={tone}
            size="sm"
            aria-disabled={pending || undefined}
            onClick={() => { if (!pending) onChange(code); }}
          />
        );
      })}
      <span role="status" className="attendance-status-saving">{pending ? "저장 중" : ""}</span>
    </div>
  );
}
