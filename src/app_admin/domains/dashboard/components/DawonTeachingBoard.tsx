import DawonStaffClock from "@/shared/product/dawon/DawonStaffClock";
import { DomainTable } from "@/shared/ui/domain";
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
  id: number; name: string; kind: "union" | "school"; track: string; school: string; members: number; courses: number[];
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
    if (!value || (key === "date" && value === today)) next.delete(key);
    else next.set(key, value);
    setParams(next, {replace: true, preventScrollReset: true});
  }
  const classes = useQuery({
    queryKey: dawonQueryKeys.teachingClasses, refetchOnMount: "always",
    queryFn: async ({signal}) => (await api.get<TeachingClass[]>("/students/class-groups/teaching/", {signal})).data,
  });
  const groups = classes.data ?? [];
  const group = groups.find(item => item.id === selectedId);
  const scope = group?.id ?? "assigned";
  const schedule = useQuery({
    queryKey: teacherTodayQueryKeys.classSessions(date, scope),
    queryFn: ({ signal }) => fetchTodaySessions(date, scope, signal),
    enabled: classes.isSuccess && groups.length > 0 && (!selectedId || !!group),
    staleTime: 30_000,
  });
  const courseGroups = new Map(groups.flatMap(item => item.courses.map(id => [id, item] as const)));
  const attendance = (lecture: number, session: number) => `/workspace/lectures/${lecture}/sessions/${session}/attendance`;
  const entries = (schedule.data ?? []).flatMap(session => {
    const owner = courseGroups.get(session.lecture);
    if (!owner || (group && owner.id !== group.id)) return [];
    return todaySessionEntries([session], date, attendance).map(entry => ({ ...entry, group: owner.name }));
  }).sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99") || a.group.localeCompare(b.group, "ko"));
  const available = group ? [group] : groups;
  const recent = available.map(item => item.recent).filter(item => item != null).sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id)[0];
  if (classes.isPending) return <p role="status">담당 반을 불러오는 중입니다.</p>;
  if (classes.isError) return <p role="alert">담당 반을 불러오지 못했습니다. <Button onClick={() => void classes.refetch()}>다시 시도</Button></p>;
  return <section className={styles.classBoard} aria-labelledby="dawon-teaching-heading">
    <header className={styles.panelHead}>
      <h1 id="dawon-teaching-heading">{date === today ? "오늘 수업" : "선택한 날의 수업"}</h1>
      <div className={styles.dateControls}><input type="date" aria-label="수업 날짜" value={date} onChange={e => select("date", e.target.value)} />
        {date !== today && <Button onClick={() => select("date", today)}>오늘</Button>}
        {(groups.length > 1 || !!selectedId) && <select aria-label="담당 반 선택" value={group?.id ?? (selectedId || "")} onChange={e => select("group", e.target.value)}>
          <option value="">담당 반 전체</option>{selectedId && !group ? <option value={selectedId}>선택한 반 확인 필요</option> : null}
          {groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      </div>
    </header>
    {!groups.length ? <p>배정된 반이 없습니다.</p> : selectedId && !group ? <p role="alert">현재 담당하는 반을 다시 선택해 주세요.</p> :
      schedule.isPending ? <p role="status">수업 일정을 불러오는 중입니다.</p> :
      schedule.isError ? <p role="alert">수업 일정을 불러오지 못했습니다. <Button onClick={() => void schedule.refetch()}>다시 시도</Button></p> :
      entries.length ? <DomainTable scrollLabel="수업 시간표" tableClassName="ds-table--flat"><thead><tr><th>시간</th><th>반</th><th>수업 · 출결</th></tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.route}><td>{entry.startTime?.slice(0,5) || "미정"}</td><td>{entry.group}</td>
          <td><Link className={styles.tableLink} to={entry.route}>{entry.label}{entry.sessionTitle && " · " + entry.sessionTitle}<ArrowRight size={14} aria-hidden /></Link></td></tr>)}</tbody></DomainTable>
      : <div className={styles.dayEmpty}><span>이날 예정된 수업이 없습니다.</span>{recent &&
        <Link to={{pathname:attendance(recent.lecture_id,recent.id),search:recent.schedule_id ? "?schedule="+recent.schedule_id : ""}}>
          최근 수업 · {shortDateWeekday(recent.date)} · {recent.title} 열기</Link>}</div>}
    <section aria-label="담당 반"><h2>담당 반</h2>
      {!!available.length && <DomainTable scrollLabel="담당 반 목록" tableClassName="ds-table--flat"><thead><tr><th>반 이름</th><th>구분</th><th>인원</th></tr></thead>
        <tbody>{available.map(item=><tr key={item.id}><td><Link className={styles.tableLink} to={`/workspace/lectures?class=${item.id}`}>{item.name}</Link></td>
          <td>{item.kind === "union" ? item.track+" 연합반" : item.school+" 내신반"}</td><td>{item.members}명</td></tr>)}</tbody></DomainTable>}
    </section>
    {available.length > 0 && <DashboardAttendanceQr lectureIds={available.flatMap(item=>item.courses)} />}
  </section>;
}

export default function DawonTeachingBoard() {
  return dawonStaffPreviewRole() === "teacher" ? <><MyTeachingBoard /><DawonStaffClock /></> : <AcademyTeachingBoard />;
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
          <Link className="ds-btn" to="/workspace/lectures">담당 강의 <ArrowRight size={15} aria-hidden /></Link>
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
