import { ArrowRight, CalendarDays } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchTodaySessions, todaySessionEntries } from "@teacher/domains/today/api";
import { teacherTodayQueryKeys } from "@teacher/domains/today/queryKeys";
import { shortDateWeekday, todayLocalISO } from "@/shared/utils/localDate";
import { Button } from "@/shared/ui/ds";
import DashboardAttendanceQr from "@/shared/ui/attendance/DashboardAttendanceQr";
import styles from "./DawonTeachingBoard.module.css";

export default function DawonTeachingBoard() {
  const today = todayLocalISO();
  const [selectedDate, setSelectedDate] = useState("");
  const date = selectedDate || today;
  const sessions = useQuery({
    queryKey: teacherTodayQueryKeys.sessions(date),
    queryFn: () => fetchTodaySessions(date),
    staleTime: 30_000,
  });
  const entries = todaySessionEntries(sessions.data ?? [], date, (lectureId, sessionId) =>
    `/workspace/lectures/${lectureId}/sessions/${sessionId}/attendance`
  ).sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));

  return (
    <section className={styles.board} aria-labelledby="dawon-teaching-heading">
      <header className={styles.heading}>
        <div>
          <h2 id="dawon-teaching-heading">{date === today ? "오늘 수업" : "선택한 날의 수업"}</h2>
          <time dateTime={date}>{shortDateWeekday(date)}</time>
        </div>
        <div className={styles.actions}>
          <Link className="ds-btn" to="/workspace/students/class-groups">반 편성</Link>
          <Link className="ds-btn" to="/workspace/lectures">반별 강의 <ArrowRight size={15} aria-hidden /></Link>
          <Link className="ds-btn" to="/workspace/clinic/operations?panel=unresolved&focus=pending">클리닉 신청</Link>
          <Link className="ds-btn" to="/workspace/community/counsel">상담 신청</Link>
          <DashboardAttendanceQr />
        </div>
      </header>
      <div className={styles.dateBar}>
        <label><CalendarDays size={16} aria-hidden /> 수업 날짜
          <input type="date" value={date} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        {date !== today && <Button size="sm" onClick={() => setSelectedDate("")}>오늘</Button>}
      </div>
      {sessions.isPending ? <p role="status">수업 일정을 불러오는 중입니다.</p>
        : sessions.isError ? <p role="alert">수업 일정을 불러오지 못했습니다. <Button size="sm" onClick={() => void sessions.refetch()}>다시 시도</Button></p>
        : entries.length ? <ul className={styles.list}>
          {entries.map((entry) => <li key={entry.route}>
            <Link className={styles.row} to={entry.route}>
              <span className={styles.time}>{entry.startTime?.slice(0, 5) || "시간 미정"}</span>
              <span className={styles.lesson}><strong>{entry.label}</strong>{entry.sessionTitle && <span>{entry.sessionTitle}</span>}</span>
              <span className={styles.attendance}>출결 <ArrowRight size={15} aria-hidden /></span>
            </Link>
          </li>)}
        </ul>
        : <div className={styles.empty}><p>이날 등록된 차시가 없습니다.</p>
          <Link to="/workspace/lectures">반별 강의에서 차시 추가 <ArrowRight size={15} aria-hidden /></Link>
        </div>}
    </section>
  );
}
