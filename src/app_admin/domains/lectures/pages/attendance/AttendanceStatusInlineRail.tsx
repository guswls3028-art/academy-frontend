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
  onChange: (value: AttendanceStatus) => void;
};

export default function AttendanceStatusInlineRail({
  studentName,
  value,
  pending,
  onChange,
}: Props) {
  return (
    <div
      className="attendance-status-inline"
      role="group"
      aria-label={`${studentName} 출결 빠른 선택`}
      aria-busy={pending}
      onClick={(event) => event.stopPropagation()}
    >
      {ORDERED_ATTENDANCE_STATUS.map((code) => {
        const active = value === code;
        const label = ATTENDANCE_META[code].label;
        const critical = code === "INACTIVE" || code === "SECESSION";
        return (
          <SelectionButton
            key={code}
            type="button"
            className="attendance-status-inline__option"
            label={label}
            selected={active}
            tone={active || critical ? ATTENDANCE_META[code].tone : "neutral"}
            size="sm"
            data-active={active ? "true" : "false"}
            data-critical={critical ? "true" : undefined}
            data-status-code={code.toLowerCase()}
            aria-label={`${studentName} ${label} 상태로 변경`}
            title={active ? `현재 ${label}` : `${label} 상태로 변경`}
            disabled={pending}
            onClick={() => onChange(code)}
          />
        );
      })}
    </div>
  );
}
