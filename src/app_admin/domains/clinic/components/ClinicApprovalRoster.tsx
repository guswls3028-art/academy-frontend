import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@/shared/ui/ds";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import { clinicNotificationTeachersQuery } from "@/shared/api/clinicNotificationTeachers";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { fetchClinicSessionTree } from "../api/clinicSessions.api";
import type { ClinicParticipant } from "../api/clinicParticipants.api";
import { clinicQueryKeys } from "../queryKeys";
import ClinicParticipantRequestSummary from "./ClinicParticipantRequestSummary";
import styles from "./ClinicApprovalRoster.module.css";

type Props = {
  rows: ClinicParticipant[];
  busy: boolean;
  onApprove: (row: ClinicParticipant) => void;
  onReject?: (row: ClinicParticipant) => void;
};

const PAGE_SIZE = 8;

function bookingTime(row: ClinicParticipant) {
  const start = hhmmText(row.booking_start_time ?? row.session_start_time);
  const end = hhmmText(row.booking_end_time ?? row.session_end_time);
  if (!start) return "시간 미정";
  if (!end) return start;
  const overnight = row.booking_end_date && row.booking_start_date
    ? row.booking_end_date > row.booking_start_date : end < start;
  return start + "–" + (overnight ? "익일 " : "") + end;
}

export default function ClinicApprovalRoster({ rows, busy, onApprove, onReject }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const last = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const page = Math.min(pageIndex, last);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const months = [...new Set(visible.filter((row) => row.session && row.session_date)
    .map((row) => row.session_date.slice(0, 7)))];
  const schedules = useQueries({ queries: months.map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { queryKey: clinicQueryKeys.sessionsTreeByMonth(year, month), queryFn: () => fetchClinicSessionTree({ year, month }), staleTime: 30_000 };
  }) });
  const sessions = new Map(schedules.flatMap((query) => (query.data ?? []).map((s) => [s.id, s] as const)));
  const hasAssignment = visible.some((row) => sessions.get(row.session)?.notification_teacher_id != null);
  const teachers = useQuery({ ...clinicNotificationTeachersQuery(), enabled: hasAssignment });
  const names = new Map(teachers.data?.map((person) => [person.id, person.name]));
  const lookupErrors = [...schedules.filter((query) => query.isError), ...(hasAssignment && teachers.isError ? [teachers] : [])];

  function assignee(row: ClinicParticipant) {
    if (!row.session) return "회차 미정";
    const schedule = schedules[months.indexOf(row.session_date?.slice(0, 7))];
    if (schedule?.isPending) return "조회 중…";
    const session = sessions.get(row.session);
    if (!session || schedule?.isError) return "확인 불가";
    if (!session.notification_teacher_id) return "미지정";
    if (teachers.isPending) return "조회 중…";
    return teachers.isError ? "확인 불가" : names.get(session.notification_teacher_id) || "현재 목록에 없음";
  }

  return <div className={styles.roster}>
    {lookupErrors.length > 0 && <div role="alert" className={styles.retry}>
      담당자 정보를 불러오지 못했습니다.
      <Button size="sm" onClick={() => lookupErrors.forEach((q) => { void q.refetch(); })}>담당자 다시 조회</Button>
    </div>}
    <table role="table" aria-label="예약 승인 대기 명단" className={styles.table}>
      <thead><tr>{["학생", "회차 · 장소", "예약 일시", "알림 담당자", "신청 상태", "처리"].map((label) =>
        <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map((row) => <tr key={row.id}>
        <th scope="row" className={styles.student}>
          <StudentDetailLink studentId={row.student} studentName={row.student_name}>
            <StudentNameWithLectureChip name={row.student_name}
              lectures={row.lecture_title && row.lecture_current !== false ? [{ lectureName: row.lecture_title, color: row.lecture_color, chipLabel: row.lecture_chip_label }] : undefined}
              clinicHighlight={row.name_highlight_clinic_target} profilePhotoUrl={row.profile_photo_url}
              enrollmentId={row.enrollment_id} avatarSize={20} density="compact" />
          </StudentDetailLink>
        </th>
        <td data-label="회차 · 장소"><strong>{row.session_title || (row.session ? "클리닉" : "회차 미정")}</strong>
          {row.session_location && <small>{row.session_location}</small>}</td>
        <td data-label="예약 일시"><strong>{bookingTime(row)}</strong><small>{row.booking_start_date || row.session_date || "날짜 미정"}</small>
          <ClinicParticipantRequestSummary participant={row} /></td>
        <td data-label="알림 담당자">{assignee(row)}</td>
        <td data-label="신청 상태"><Badge tone={row.requested_after_cutoff ? "warning" : "neutral"}>
          {row.requested_after_cutoff ? "마감 후 대기" : "승인 대기"}</Badge></td>
        <td className={styles.actions}><div>
          <Button size="sm" intent="primary" disabled={busy} onClick={() => onApprove(row)}>승인</Button>
          {onReject && <Button size="sm" disabled={busy} onClick={() => onReject(row)}>거절</Button>}
        </div></td>
      </tr>)}</tbody>
    </table>
    {last > 0 && <nav className={styles.pager} aria-label="승인 명단 페이지">
      <Button size="sm" disabled={page === 0} onClick={() => setPageIndex(page - 1)}>이전</Button>
      <span>{page + 1} / {last + 1}</span>
      <Button size="sm" disabled={page === last} onClick={() => setPageIndex(page + 1)}>다음</Button>
    </nav>}
  </div>;
}
