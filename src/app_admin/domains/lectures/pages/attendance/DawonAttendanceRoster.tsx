import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AttendanceListItem } from "@admin/domains/lectures/api/attendance";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { DomainTable } from "@/shared/ui/domain";
import StudentLectureMemo from "@/shared/ui/enrollment/StudentLectureMemo";
import { ATTENDANCE_META, ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";
import { formatPhone } from "@/shared/utils/formatPhone";
import ArrivalPlanCell, { type ArrivalPlanPayload } from "./ArrivalPlanCell";
import type { AttendanceSort, AttendanceSortColumn } from "./attendanceSort";
import styles from "./DawonAttendanceRoster.module.css";

type Props = {
  rows: AttendanceListItem[];
  selected: Set<number>;
  pending: Set<number>;
  allSelected: boolean;
  toggleAll: () => void;
  toggle: (id: number) => void;
  sort: AttendanceSort;
  onSort: (key: AttendanceSortColumn) => void;
  changeStatus: (row: AttendanceListItem, code: AttendanceStatus) => Promise<void>;
  supplement: boolean;
  sessionDate?: string | null;
  savePlan: (id: number, value: ArrivalPlanPayload) => Promise<void>;
};

export default function DawonAttendanceRoster(props: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  function heading(key: AttendanceSortColumn, label: string) {
    const direction = props.sort === key ? "ascending" : props.sort === "-" + key ? "descending" : "none";
    return <th scope="col" aria-sort={direction} className={key === "name" ? undefined : styles.phone}>
      <button type="button" onClick={() => props.onSort(key)} aria-label={label + " 정렬"}>
        {label} <span aria-hidden>{direction === "ascending" ? "↑" : direction === "descending" ? "↓" : "↕"}</span>
      </button>
    </th>;
  }
  return <div className={styles.roster}><DomainTable scrollLabel="차시 출결 명단" tableClassName={styles.table + " ds-table--flat"}>
    <thead><tr>
      <th scope="col" className={styles.check}><input type="checkbox" checked={props.allSelected} onChange={props.toggleAll} aria-label="전체 선택" /></th>
      {heading("name","이름")}<th scope="col">출결 상태</th>{heading("parent_phone","학부모 연락처")}{heading("phone","학생 연락처")}
      <th scope="col" className={styles.more}>상세</th>
    </tr></thead>
    <tbody>{props.rows.map(row => {
      const name = row.name ?? row.student_name ?? "학생";
      const status = ORDERED_ATTENDANCE_STATUS.find(code => code === row.status) ?? "UNSET";
      const open = expanded === row.id;
      const saving = props.pending.has(row.id);
      return <Fragment key={row.id}><tr aria-busy={saving} className={props.selected.has(row.id) ? "ds-row-selected" : undefined}>
        <td className={styles.check}><input type="checkbox" checked={props.selected.has(row.id)} onChange={() => props.toggle(row.id)} aria-label={name + " 선택"} /></td>
        <td className={styles.name}><StudentDetailLink studentId={row.student_id ?? row.enrollment?.student_id} studentName={name}>{name}</StudentDetailLink>
          {row.name_highlight_clinic_target && <small>클리닉 대상</small>}</td>
        <td><select value={status} aria-label={name + " 출결 상태"} disabled={saving} onChange={e => void props.changeStatus(row,e.target.value as AttendanceStatus)}>
          {ORDERED_ATTENDANCE_STATUS.map(code => <option key={code} value={code}>{ATTENDANCE_META[code].label}</option>)}
        </select>{saving && <small role="status">저장 중</small>}</td>
        <td className={styles.phone}>{formatPhone(row.parent_phone)}</td><td className={styles.phone}>{formatPhone(row.phone ?? row.student_phone)}</td>
        <td className={styles.more}><button type="button" aria-label={name + " 연락처·메모" + (props.supplement ? "·등원 예정" : "")} aria-expanded={open}
          onClick={() => setExpanded(open ? null : row.id)}>{open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button></td>
      </tr>{open && <tr><td colSpan={6}><div className={styles.detail}>
        <span>학부모 {formatPhone(row.parent_phone)} · 학생 {formatPhone(row.phone ?? row.student_phone)}</span>
        {props.supplement && <ArrivalPlanCell studentName={name} plannedDate={row.planned_arrival_date} plannedTime={row.planned_arrival_time}
          memo={row.memo} defaultDate={props.sessionDate} onSave={value => props.savePlan(row.id,value)} />}
        {row.enrollment_id != null && <StudentLectureMemo compact enrollmentId={row.enrollment_id} studentName={name} lectureTitle={row.lecture_title} lectureMemo={row.lecture_memo} studentMemo={row.student_memo}/>}
      </div></td></tr>}</Fragment>;
    })}</tbody>
  </DomainTable></div>;
}
