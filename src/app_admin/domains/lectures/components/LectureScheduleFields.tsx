import { SESSION_SCHEDULE_DAY_LIMIT } from "@/shared/api/contracts/sessionSchedules";
import { Button } from "@/shared/ui/ds";
import { lectureWeekdays, type LectureScheduleDefault, type LectureScheduleMode } from "../lectureScheduleSettings";

export type LectureScheduleDraftRow = LectureScheduleDefault & { key: string };

type Props = {
  mode: LectureScheduleMode;
  rows: LectureScheduleDraftRow[];
  disabled: boolean;
  onModeChange: (mode: LectureScheduleMode) => void;
  onRowsChange: (rows: LectureScheduleDraftRow[]) => void;
};

export default function LectureScheduleFields({ mode, rows, disabled, onModeChange, onRowsChange }: Props) {
  function updateRow(key: string, patch: Partial<LectureScheduleDefault>) {
    onRowsChange(rows.map(row => row.key === key ? { ...row, ...patch } : row));
  }

  return (
    <div className="modal-form-group modal-form-group--neutral lecture-schedule-fields">
      <label className="lecture-field-label" htmlFor="lecture-schedule-mode">수업 운영 방식</label>
      <select id="lecture-schedule-mode" className="ds-select" value={mode} disabled={disabled} onChange={event => onModeChange(event.target.value as LectureScheduleMode)}>
        <option value="SINGLE">차시당 한 수업</option>
        <option value="SPLIT">반별로 나눠 진행</option>
      </select>
      {mode === "SPLIT" && (
        <fieldset className="lecture-schedule-defaults" disabled={disabled}>
          <legend className="sr-only">반별 기본 일정</legend>
          <p>새 차시에 반 이름과 요일을 미리 채웁니다.</p>
          {rows.map((row, index) => (
            <div className="lecture-schedule-row" key={row.key}>
              <input className="ds-input" value={row.label} maxLength={40} placeholder="반 이름"
                aria-label={`${index + 1}번째 반 이름`} onChange={event => updateRow(row.key, { label: event.target.value })} />
              <select className="ds-select" value={row.weekday} aria-label={`${index + 1}번째 반 기본 요일`}
                onChange={event => updateRow(row.key, { weekday: Number(event.target.value) })}>
                {lectureWeekdays.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}요일</option>)}
              </select>
              {rows.length > 2 && <Button intent="ghost" size="sm" aria-label={`${index + 1}번째 반 제거`}
                onClick={() => onRowsChange(rows.filter(item => item.key !== row.key))}>제거</Button>}
            </div>
          ))}
          {rows.length < SESSION_SCHEDULE_DAY_LIMIT ? (
            <Button intent="secondary" size="sm" onClick={() => onRowsChange([...rows, {
              key: crypto.randomUUID(), label: "", weekday: (rows[rows.length - 1]?.weekday ?? 0) % 7 + 1,
            }])}>반 추가</Button>
          ) : <p>최대 {SESSION_SCHEDULE_DAY_LIMIT}개 반을 저장할 수 있습니다.</p>}
        </fieldset>
      )}
    </div>
  );
}
