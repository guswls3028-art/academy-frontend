import { dawonQueryKeys } from "@/shared/product/dawon/queryKeys";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchTodaySessions, todaySessionEntries } from "@teacher/domains/today/api";
import { teacherTodayQueryKeys } from "@/shared/api/queryKeys/sessionSchedules";
import { shortDateWeekday, todayLocalISO } from "@/shared/utils/localDate";
import { Button } from "@/shared/ui/ds";
import DashboardAttendanceQr from "@/shared/ui/attendance/DashboardAttendanceQr";
import api from "@/shared/api/axios";
import { dawonStaffPreviewRole } from "@/shared/product/dawon/staffPreview";
import styles from "./DawonTeachingBoard.module.css";

type TeachingClass = {
  id: number; name: string; members: number; courses: number[];
  recent: {id: number; lecture_id: number; title: string; date: string; schedule_id: number | null} | null;
};

function MyTeachingBoard() {
  const today = todayLocalISO();
  const [params, setParams] = useSearchParams();
  const requestedDate = params.get("date") || "";
  const parsedDate = Date.parse(requestedDate);
  const date = Number.isFinite(parsedDate) && new Date(parsedDate).toISOString().slice(0, 10) === requestedDate
    ? requestedDate : today;
  const selectedId = Number(params.get("group"));
  function select(key: "date" | "group", value: string) {
    const next = new URLSearchParams(params);
    if (key === "date" && (!value || value === today)) next.delete(key);
    else next.set(key, value);
    setParams(next, {replace: true, preventScrollReset: true});
  }
  const classes = useQuery({
    queryKey: dawonQueryKeys.teachingClasses, refetchOnMount: "always",
    queryFn: async ({signal}) => (await api.get<TeachingClass[]>("/students/class-groups/teaching/", {signal})).data,
  });
  const groups = classes.data ?? [];
  const group = groups.find(item => item.id === selectedId) ?? groups[0];
  const schedule = useQuery({
    queryKey: teacherTodayQueryKeys.classSessions(date, group?.id), queryFn: () => fetchTodaySessions(date, group?.id), enabled: !!group, staleTime: 30_000,
  });
  const attendance = (lectureId: number, sessionId: number) => `/workspace/lectures/${lectureId}/sessions/${sessionId}/attendance`;
  const entries = todaySessionEntries((schedule.data ?? []).filter(s => group?.courses.includes(s.lecture)), date, attendance)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
  if (classes.isPending) return <p role="status">담당 반을 불러오는 중입니다.</p>;
  if (classes.isError) return <p role="alert">담당 반을 불러오지 못했습니다. <Button onClick={() => void classes.refetch()}>다시 시도</Button></p>;
  if (!group) return <section className={styles.board}><h1>담당 반</h1><p>담당 강의가 연결된 반이 없습니다.</p><Link className={styles.action} to="/workspace/lectures">반별 강의 열기</Link></section>;
  const recent = group.recent;
  return <section className={styles.classBoard} aria-labelledby="dawon-class-title">
    <header className={styles.classHead}><div><span className={styles.context}>담당 반</span>
      <h1 id="dawon-class-title">{group.name}</h1><p>학생 {group.members}명</p></div>
      {groups.length > 1 && <label className={styles.switchClass}>담당 반 선택<select aria-label="담당 반 선택" value={group.id} onChange={e => select("group", e.target.value)}>
        {groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <Link className={styles.action} to={`/workspace/lectures?class=${group.id}`}>반 수업 관리 <ArrowRight size={16} aria-hidden /></Link>
    </header>
    <section className={styles.sessionPanel} aria-labelledby="dawon-teaching-heading">
      <header className={styles.panelHead}><h2 id="dawon-teaching-heading">{date === today ? "오늘 수업" : "선택한 날의 수업"}</h2>
        <div className={styles.dateControls}><input type="date" aria-label="수업 날짜" value={date} onChange={e => select("date", e.target.value)} />
        {date !== today && <Button onClick={() => select("date", today)}>오늘</Button>}</div></header>
      {schedule.isPending ? <p role="status">수업 일정을 불러오는 중입니다.</p> :
        schedule.isError ? <p role="alert">수업 일정을 불러오지 못했습니다. <Button onClick={() => void schedule.refetch()}>다시 시도</Button></p> :
        entries.length ? <ul className={styles.list}>{entries.map(entry => <li key={entry.route}><Link className={styles.row} to={entry.route}>
          <span className={styles.time}>{entry.startTime?.slice(0,5) || "시간 미정"}</span>
          <span className={styles.lesson}><strong>{entry.label}</strong>{entry.sessionTitle && <span>{entry.sessionTitle}</span>}</span>
          <span className={styles.attendance}>출결 열기 <ArrowRight size={15} aria-hidden /></span>
        </Link></li>)}</ul> : <p className={styles.noLesson}>이날 예정된 수업이 없습니다.</p>}
      {recent && !schedule.isPending && !schedule.isError && !entries.length &&
        <Link className={styles.recent} to={{pathname: attendance(recent.lecture_id, recent.id), search: recent.schedule_id ? "?schedule=" + recent.schedule_id : ""}}><span><small>최근 수업 · {shortDateWeekday(recent.date)}</small><strong>{recent.title}</strong></span><span>수업 열기 <ArrowRight size={15} aria-hidden /></span></Link>}
      <div className={styles.qr}><DashboardAttendanceQr lectureIds={group.courses} /></div>
    </section>
  </section>;
}

export default function DawonTeachingBoard() {
  return dawonStaffPreviewRole() === "teacher" ? <MyTeachingBoard /> : <AcademyTeachingBoard />;
}

function AcademyTeachingBoard() {
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
