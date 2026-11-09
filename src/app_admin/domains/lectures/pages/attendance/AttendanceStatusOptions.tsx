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
  return (
    <div
      className="attendance-status-options"
      role="group"
      aria-label={studentName + " 출결 상태 선택"}
      onClick={(event) => event.stopPropagation()}
    >
      {ORDERED_ATTENDANCE_STATUS.map((code) => {
        const { label, tone } = ATTENDANCE_META[code];
        const selected = value === code;
        return (
          <SelectionButton
            key={code}
            className="attendance-status-option"
            label={label}
            selected={selected}
            tone={selected || tone === "success" || tone === "danger" ? tone : "neutral"}
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
