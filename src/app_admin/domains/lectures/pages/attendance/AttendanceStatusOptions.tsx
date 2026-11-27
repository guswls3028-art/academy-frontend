import { Button, SelectionButton } from "@/shared/ui/ds";
import {
  ATTENDANCE_META,
  ORDERED_ATTENDANCE_STATUS,
  type AttendanceStatus,
} from "@/shared/ui/badges/attendanceStatus";

type Props = {
  studentName: string;
  value: AttendanceStatus;
  pending: boolean;
  onReregister?: () => void;
  onChange: (status: AttendanceStatus) => void;
};

export default function AttendanceStatusOptions({ studentName, value, pending, onChange, onReregister }: Props) {
  const withdrawn = value === "SECESSION";
  return (
    <div
      className="attendance-status-options"
      data-withdrawn={withdrawn || undefined}
      role="group"
      aria-label={studentName + " 출결 상태 선택"}
      onClick={(event) => event.stopPropagation()}
    >
      {(withdrawn ? (["SECESSION"] as const) : ORDERED_ATTENDANCE_STATUS).map((code) => {
        const { label, tone } = ATTENDANCE_META[code];
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
      {withdrawn && onReregister && (
        <Button type="button" size="sm" intent="secondary" disabled={pending}
          aria-label={studentName + " 재등록"} onClick={onReregister}>재등록</Button>
      )}
      <span role="status" className="attendance-status-saving">{pending ? "저장 중" : ""}</span>
    </div>
  );
}
