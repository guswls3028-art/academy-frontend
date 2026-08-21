import AttendanceStatusBadge, {
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";
import {
  ATTENDANCE_META,
  ORDERED_ATTENDANCE_STATUS,
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
        return (
          <button
            key={code}
            type="button"
            className="attendance-status-inline__option"
            data-active={active ? "true" : "false"}
            aria-pressed={active}
            aria-label={`${studentName} ${label} 상태로 변경`}
            title={active ? `현재 ${label}` : `${label} 상태로 변경`}
            disabled={pending}
            onClick={() => onChange(code)}
          >
            <AttendanceStatusBadge status={code} variant="2ch" selected={active} />
          </button>
        );
      })}
    </div>
  );
}
