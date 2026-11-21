import { Link, useSearchParams } from "react-router";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import DawonDirectoryTable from "./DawonDirectoryTable";
import { todayInSeoul, useDawonDailyAttendance } from "./useDawonDailyAttendance";
import styles from "./DawonDailyAttendance.module.css";

const dashboard = "/workspace/dashboard";

export default function DawonDailyAttendance() {
  const [params, setParams] = useSearchParams();
  const day = params.get("date") ?? todayInSeoul();
  const group = params.get("group");
  const search = params.get("q") ?? "";
  const query = useDawonDailyAttendance(day, group);
  function selection(date: string, term: string, id?: number) {
    const next = new URLSearchParams({panel: "attendance", date});
    if (term) next.set("q", term);
    if (params.has("attention")) next.set("attention", params.get("attention")!);
    if (id !== undefined) next.set("group", String(id));
    return next;
  }
  const overview = dashboard + "?" + selection(day, search);
  const dashboardFilters = selection(day, search);
  dashboardFilters.delete("panel");
  const data = query.data;
  const rows = (data?.groups ?? []).filter(row => row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <DomainLayout title={group === null ? "반별 출결 현황" : (data?.group_name ?? "반 출결 상세")}
    breadcrumbs={group === null ? [] : [{label: "반별 출결 현황", to: overview}]}>
    <div className={styles.section}>
      <div className={styles.tools}>
        <label>수업 날짜<input className="ds-input" type="date" value={day} required
          onChange={event => { if (event.target.value) setParams(selection(event.target.value, search, group === null ? undefined : Number(group))); }}/></label>
        {group === null && <label>반 검색<input className="ds-input" type="search" value={search} placeholder="반 이름 검색"
          onChange={event => setParams(selection(day, event.target.value), {replace: true})}/></label>}
        <nav aria-label="운영 화면">
          {group !== null && <Link to={overview}>반별 출결 목록</Link>}
          <Link to={dashboard + "?" + dashboardFilters}>반 운영 현황</Link>
          <Link to={dashboard + "?panel=alerts"}>학습 경보</Link>
        </nav>
      </div>
      {query.isPending ? <p role="status">출결을 불러오는 중입니다.</p> : query.isError || !data ?
        <p role="alert">출결을 불러오지 못했습니다. <Button onClick={() => void query.refetch()}>다시 시도</Button></p> :
        group === null ? <>
          <p>수강생 한 명이 차시 두 개에 참여하면 출결 2건으로 집계합니다.</p>
          <DawonDirectoryTable id="dawon-daily-attendance" label="반별 차시 출결" rows={rows}
            empty={search.trim() ? "검색한 반의 수업이 없습니다." : "선택한 날짜에 예정된 수업이 없습니다."} columns={[
              {key: "name", label: "반", defaultWidth: 190, value: row => row.name,
                render: row => <Link to={dashboard + "?" + selection(day, search, row.id)}>{row.name}</Link>},
              {key: "lessons", label: "차시", defaultWidth: 78, value: row => row.lesson_count},
              {key: "total", label: "출결 대상", defaultWidth: 108, value: row => row.total},
              {key: "marked", label: "입력 완료", defaultWidth: 108, value: row => row.marked},
              {key: "unset", label: "미입력", defaultWidth: 92, value: row => row.unset},
              {key: "missing", label: "기록 없음", defaultWidth: 108, value: row => row.missing},
              {key: "absent", label: "결석", defaultWidth: 78, value: row => row.absent},
            ]}/>
        </> : !data.lessons.length ? <p>선택한 날짜에 이 반의 수업이 없습니다.</p> :
        data.lessons.map(lesson => <section key={lesson.id} className={styles.lesson}>
          <h2>{lesson.course} · {lesson.order}차시{lesson.title && " · " + lesson.title}</h2>
          <table><caption>수강생 {lesson.students.length}명</caption>
            <thead><tr><th scope="col">이름</th><th scope="col">출결 상태</th></tr></thead>
            <tbody>{lesson.students.map(student => <tr key={student.enrollment}>
              <th scope="row">{student.name}</th><td>{student.status === null ? "기록 없음" : (data.status_labels[student.status] ?? student.status)}</td>
            </tr>)}</tbody>
          </table>
          {!lesson.students.length && <p>이 차시에 배정된 수강생이 없습니다.</p>}
        </section>)}
    </div>
  </DomainLayout>;
}
