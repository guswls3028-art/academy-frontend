import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import DashboardAttendanceQr from "@/shared/ui/attendance/DashboardAttendanceQr";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import { buildAssessmentSearch } from "@/shared/lib/assessmentQueryParams";
import { todayInSeoul } from "./useDawonDailyAttendance";
import { useAlertSummary } from "./alertQueue";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonDayDesk.module.css";

type Lesson = {session:number; schedule:number|null; start:string|null; group:string; course:number; course_title:string; title:string; slot:string};
type Day = {
  agenda:Lesson[]; arrivals:number;
  groups:{total:number;missing:number;unset:number}[];
  clinics:{id:number;title:string;start_time:string;location:string}[];
  counsel:{id:number;student:string;course:string}[];
  assignments:{id:number;title:string;session_id:number;assigned:number;submitted:number;missing:number;deferred:number}[];
};
const dashboard = "/workspace/dashboard";
export default function DawonDayDesk() {
  const [params,setParams]=useSearchParams();
  const today=todayInSeoul();
  const day=params.get("date") || today;
  const alertFeed=useAlertSummary("admin");
  const filters={view:"day",date:day};
  const query=useQuery({queryKey:dawonQueryKeys.adminLearning(filters),queryFn:async ({signal})=>
    (await api.get<Day>("/students/demo-operations/",{params:filters,signal})).data});
  const data=query.data;
  const attendance=dashboard+"?panel=attendance&date="+day;
  const schedule=[
    ...(data?.agenda ?? []).map(row=>({key:"lesson-"+row.session+"-"+row.schedule, start:row.start,
      label:"수업",name:row.title,meta:[row.group,row.course_title,row.slot].filter(Boolean).join(" · "),
      to:`/workspace/lectures/${row.course}/sessions/${row.session}/attendance`+(row.schedule?"?schedule="+row.schedule:"")})),
    ...(data?.clinics ?? []).map(row=>({key:"clinic-"+row.id,start:row.start_time,label:"클리닉",name:row.title || "클리닉",meta:row.location,
      to:`/workspace/clinic/operations?panel=day&session=${row.id}&date=${day}`})),
    ...(data?.counsel ?? []).map(row=>({key:"care-"+row.id,start:null,label:"상담",name:row.student+" 상담",meta:row.course,
      to:`/workspace/community/counsel?kind=appointments&record=${row.id}&from=${day}&to=${day}`})),
  ].sort((a,b)=>(a.start||"99").localeCompare(b.start||"99") || a.name.localeCompare(b.name,"ko"));
  const sessions=new Map(data?.agenda.map(row=>[row.session,row]));
  const outstanding=data?.groups.reduce((sum,row)=>sum+row.missing+row.unset,0);
  function selectDay(value:string) { if(value)setParams(value===today?{}:{date:value}); }
  return <DomainLayout title="대시보드" density="compact" breadcrumbs={[]}>
    <div className={styles.desk}>
      <header className={styles.heading}><h2>{day===today?"오늘의 운영":"일별 운영"}</h2>
        <div><DashboardAttendanceQr/><input aria-label="운영 날짜" type="date" className="ds-input" value={day} onChange={e=>selectDay(e.target.value)}/>
        {day!==today && <Button size="sm" onClick={()=>selectDay(today)}>오늘</Button>}</div>
      </header>
      <nav className={styles.summary} aria-label="확인할 업무">
        <Link to={attendance}><span>등원 기록</span><strong>{data?data.arrivals+"건":"—"}</strong><small>출석 · 지각 · 조퇴</small></Link>
        <Link to={attendance}><span>출결 미입력</span><strong>{outstanding===undefined?"—":outstanding+"건"}</strong><small>차시별 명단 열기</small></Link>
        <Link to={dashboard+"?panel=alerts"}><span>미처리 학습 경보</span><strong>{alertFeed.data?alertFeed.data.pending+"건":"—"}</strong><small>현재 처리 대기</small></Link>
      </nav>
      {alertFeed.isError && <p role="alert">학습 경보를 불러오지 못했습니다. <Button onClick={()=>void alertFeed.refetch()}>다시 시도</Button></p>}
      {query.isPending?<p role="status">일정을 불러오는 중입니다.</p>:query.isError||!data?<p role="alert">이 날짜의 운영 기록을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p>:
      <div className={styles.columns}>
        <section><h3>수업·클리닉·상담 일정</h3>{schedule.length?<ul>{schedule.map(row=><li key={row.key}>
          <Link to={row.to}><time>{row.start?.slice(0,5) || "시간 미정"}</time><div><small>{row.label}</small><strong>{row.name}</strong><span>{row.meta}</span></div></Link>
        </li>)}</ul>:<p>예정된 수업·클리닉·상담이 없습니다.</p>}</section>
        <section><h3>수업별 과제 제출</h3>{data.assignments.length?<ul>{data.assignments.map(row=>{
          const lesson=sessions.get(row.session_id);
          if(!lesson)return null;
          return <li key={row.id}><Link to={`/workspace/lectures/${lesson.course}/sessions/${row.session_id}/assignments`+buildAssessmentSearch("homework",row.id)}>
            <div><small>{lesson.group} · {lesson.course_title}</small><strong>{row.title}</strong>
            <span>제출 {row.submitted} / {row.assigned}명 · 미제출 {row.missing}명{row.deferred?" · 검사 보류 "+row.deferred+"명":""}</span></div></Link></li>;
        })}</ul>:<p>이날 수업에 배정된 과제가 없습니다.</p>}</section>
      </div>}
    </div>
  </DomainLayout>;
}
